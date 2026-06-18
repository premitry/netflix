// Penanganan update Telegram: perintah, wizard, pencarian, menu admin & buyer.
import type { Env } from "./env"
import { Telegram, type InlineButton } from "./telegram"
import { ui, frame, BRAND, setBrand, setWelcome, categoryKeyboard, resultKeyboard, foundKeyboard, cancelSearchKeyboard, notFoundKeyboard } from "./ui"
import { CATEGORIES, fetchHouseholdCode, findLatest, type CategoryKey } from "./netflix"
import { ImapClient, testImap, type RawMessage, type ImapSecurity } from "./imap"
import { hashPassword, genPassword } from "./auth"
import * as backup from "./backup"
import * as db from "./db"

const EMAIL_RE = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/

// Auto-deteksi @username dari ID Telegram (via getChat) untuk yang belum tersimpan.
export async function resolveUsernames(
	env: Env,
	ids: Array<number | null | undefined>,
): Promise<Record<number, string>> {
	const map = await db.getUsernames(env.DB, ids)
	const tg = new Telegram(env.BOT_TOKEN)
	const missing = [...new Set(ids.filter((x): x is number => !!x && !map[x]))]
	for (const id of missing) {
		try {
			const res = await tg.getChat(id)
			const uname = res?.result?.username
			if (uname) {
				map[id] = uname
				await db.trackUser(env.DB, id, uname).catch(() => {})
			}
		} catch {
			// abaikan: user belum pernah /start atau tidak punya @username
		}
	}
	return map
}

export async function handleUpdate(update: any, env: Env): Promise<void> {
	const tg = new Telegram(env.BOT_TOKEN)
	await loadBranding(env)
	const fromId = update.message?.from?.id ?? update.callback_query?.from?.id
	const fromUsername = update.message?.from?.username ?? update.callback_query?.from?.username
	if (fromId) await db.trackUser(env.DB, fromId, fromUsername).catch(() => {})
	if (update.message) await onMessage(tg, env, update.message)
	else if (update.callback_query) await onCallback(tg, env, update.callback_query)
}

// Muat nama & teks kustom dari settings agar admin bisa rebrand bot.
async function loadBranding(env: Env): Promise<void> {
	try {
		setBrand(await db.getSetting(env.DB, "brand_name"))
		setWelcome(await db.getSetting(env.DB, "welcome_text"))
	} catch {
		// pakai default bila gagal
	}
}

// ---------- helpers ----------
async function privileged(env: Env, tid: number): Promise<boolean> {
	if (await db.isAdmin(env.DB, tid)) return true
	const b = await db.getBuyerByTelegram(env.DB, tid)
	return db.isBuyerActive(b)
}

// Boleh akses kategori privat (Reset Email/Password)? Admin, atau member aktif
// yang merupakan PEMILIK domain email tsb. Member lain diperlakukan seperti publik.
async function canPrivate(env: Env, tid: number, email: string | undefined): Promise<boolean> {
	if (!email) return false
	if (await db.isAdmin(env.DB, tid)) return true
	const domain = email.split("@")[1]
	if (!domain) return false
	const owner = await db.getDomainOwner(env.DB, domain)
	if (!owner) return false
	const me = await db.getBuyerByTelegram(env.DB, tid)
	return me != null && db.isBuyerActive(me) && owner.buyer_id === me.id
}

// Whitelist akses: apakah requester boleh memakai domain pemilik email ini?
// Admin & member pemilik domain selalu boleh. Whitelist pemilik kosong -> terbuka.
async function whitelistAllows(env: Env, tid: number, email: string | undefined): Promise<boolean> {
	if (!email) return true
	if (await db.isAdmin(env.DB, tid)) return true
	const domain = email.split("@")[1]
	if (!domain) return true
	const owner = await db.getDomainOwner(env.DB, domain)
	if (!owner) return true
	const ownerBuyer = await db.getBuyerById(env.DB, owner.buyer_id)
	if (ownerBuyer && ownerBuyer.telegram_id === tid) return true
	const unames = await db.getUsernames(env.DB, [tid])
	return db.isWhitelisted(env.DB, owner.buyer_id, tid, unames[tid] || null)
}

function adminMenu(): InlineButton[][] {
	return [
		[{ text: "\u2795 Tambah Member", callback_data: "adm:addbuyer" }],
		[{ text: "\uD83D\uDC65 List Member", callback_data: "adm:listbuyer" }],
		[{ text: "\uD83D\uDCBE Backup Sekarang", callback_data: "adm:backupnow" }],
		[{ text: "\uD83C\uDFA8 Branding (Nama & Teks)", callback_data: "adm:branding" }],
		[{ text: "\u2699\uFE0F Menu Member (IMAP/Domain)", callback_data: "by:menu" }],
	]
}

function buyerMenu(): InlineButton[][] {
	return [
		[{ text: "\u2699\uFE0F Atur IMAP", callback_data: "by:setimap" }],
		[{ text: "\uD83C\uDF10 Kelola Domain", callback_data: "by:domains" }],
		[{ text: "\uD83D\uDD10 Whitelist User", callback_data: "by:wl" }],
		[{ text: "\uD83D\uDD0C Tes Koneksi", callback_data: "by:test" }],
		[{ text: "\uD83D\uDCCA Status", callback_data: "by:status" }],
	]
}

function securityKeyboard(): InlineButton[][] {
	return [
		[
			{ text: "\uD83D\uDD12 SSL/TLS (993)", callback_data: "sec:ssl" },
			{ text: "\uD83D\uDD13 STARTTLS (143)", callback_data: "sec:starttls" },
		],
		[{ text: "\u274C Batal", callback_data: "cancel" }],
	]
}

function cancelKb(): InlineButton[][] {
	return [[{ text: "\u274C Batal", callback_data: "cancel" }]]
}

// ---------- message handler ----------
async function onMessage(tg: Telegram, env: Env, msg: any): Promise<void> {
	const chatId = msg.chat.id as number
	const tid = msg.from.id as number
	const text: string = (msg.text || "").trim()

	// Dokumen (untuk /restore)
	if (msg.document) {
		await handleDocument(tg, env, chatId, tid, msg.document)
		return
	}

	// Perintah
	if (text.startsWith("/")) {
		await handleCommand(tg, env, chatId, tid, text)
		return
	}

	// Lanjutan wizard?
	const state = await db.getState(env.DB, tid)
	if (state && state.step !== "pending_email") {
		await handleWizardText(tg, env, chatId, tid, text, state)
		return
	}

	// Input email untuk pencarian
	const m = text.match(EMAIL_RE)
	if (m) {
		const email = text.toLowerCase()
		const domain = email.split("@")[1]
		const owner = await db.getDomainOwner(env.DB, domain)
		if (!owner) {
			await db.clearState(env.DB, tid)
			await tg.sendMessage(
				chatId,
				frame(BRAND, [
					"❌ Email <code>" + email + "</code> tidak valid / belum terdaftar.",
					"Domain <code>" + domain + "</code> belum terdaftar di sistem.",
					"",
					"Hubungi penjual untuk memastikan domainmu sudah aktif.",
				]),
			)
			return
		}
		if (!(await whitelistAllows(env, tid, email))) {
			await db.clearState(env.DB, tid)
			await tg.sendMessage(
				chatId,
				frame(BRAND, [
					"\uD83D\uDD12 Akses ditolak.",
					"Kamu tidak ada dalam whitelist pemilik domain <code>" + domain + "</code>.",
					"",
					"Hubungi penjual untuk didaftarkan.",
				]),
			)
			return
		}
		const priv = await canPrivate(env, tid, email)
		await db.setState(env.DB, tid, "pending_email", { email })
		await tg.sendMessage(chatId, ui.chooseCategory(email, priv), categoryKeyboard(priv))
		return
	}

	if (text.includes("@")) {
		await tg.sendMessage(chatId, ui.invalidEmail())
		return
	}

	await tg.sendMessage(chatId, ui.welcome())
}

// ---------- commands ----------
async function handleCommand(
	tg: Telegram,
	env: Env,
	chatId: number,
	tid: number,
	text: string,
): Promise<void> {
	const [cmd, ...args] = text.split(/\s+/)
	const isAdm = await db.isAdmin(env.DB, tid)

	switch (cmd) {
		case "/start": {
			// /start: tampilan welcome SAMA untuk semua (admin, buyer, user biasa).
			await db.clearState(env.DB, tid)
			await tg.sendMessage(chatId, ui.welcome())
			return
		}
		case "/menu": {
			// /menu: menu sesuai role; hanya admin & buyer aktif yang punya menu.
			await db.clearState(env.DB, tid)
			if (isAdm) {
				await tg.sendMessage(chatId, frame(BRAND, ["\uD83D\uDEE1\uFE0F Panel Admin"]), adminMenu())
			} else {
				const b = await db.getBuyerByTelegram(env.DB, tid)
				if (db.isBuyerActive(b)) {
					await tg.sendMessage(chatId, frame(BRAND, ["\uD83D\uDC64 Menu Member"]), buyerMenu())
				} else {
					await tg.sendMessage(chatId, ui.welcome())
				}
			}
			return
		}
		case "/myid":
			await tg.sendMessage(chatId, ui.myId(tid))
			return
		case "/setadmin": {
			const count = await db.countAdmins(env.DB)
			if (count === 0) {
				await db.addAdmin(env.DB, tid)
				await tg.sendMessage(chatId, frame(BRAND, ["\u2705 Kamu sekarang admin pertama."]), adminMenu())
			} else if (isAdm) {
				await tg.sendMessage(chatId, frame(BRAND, ["Kamu sudah admin."]))
			} else {
				await tg.sendMessage(chatId, frame(BRAND, ["\u274C Admin sudah ada."]))
			}
			return
		}
		case "/admin":
			if (!isAdm) return void tg.sendMessage(chatId, ui.denied())
			await tg.sendMessage(chatId, frame(BRAND, ["\uD83D\uDEE1\uFE0F Panel Admin"]), adminMenu())
			return
		case "/grant": {
			if (!isAdm) return void tg.sendMessage(chatId, ui.denied())
			const gid = parseInt(args[0], 10)
			const days = parseInt(args[1], 10)
			if (Number.isNaN(gid) || Number.isNaN(days))
				return void tg.sendMessage(chatId, frame(BRAND, ["Format: /grant <id> <hari>"]))
			const b = await db.grantBuyer(env.DB, { telegram_id: gid, days, created_by: tid })
			await tg.sendMessage(
				chatId,
				frame(BRAND, [`\u2705 Member <code>${gid}</code> aktif sampai`, `<b>${fmtDate(b.expired_at)}</b>`]),
			)
			await notifyBuyer(tg, gid, b.expired_at)
			return
		}
		case "/extend": {
			if (!isAdm) return void tg.sendMessage(chatId, ui.denied())
			const gid = parseInt(args[0], 10)
			const days = parseInt(args[1], 10)
			if (Number.isNaN(gid) || Number.isNaN(days))
				return void tg.sendMessage(chatId, frame(BRAND, ["Format: /extend <id> <hari>"]))
			const b = await db.grantBuyer(env.DB, { telegram_id: gid, days, created_by: tid })
			await tg.sendMessage(chatId, frame(BRAND, [`\u2705 Diperpanjang sampai ${fmtDate(b.expired_at)}`]))
			return
		}
		case "/revoke": {
			if (!isAdm) return void tg.sendMessage(chatId, ui.denied())
			const gid = parseInt(args[0], 10)
			const b = await db.getBuyerByTelegram(env.DB, gid)
			if (!b) return void tg.sendMessage(chatId, frame(BRAND, ["Member tidak ditemukan."]))
			await db.revokeBuyer(env.DB, b.id)
			await tg.sendMessage(chatId, frame(BRAND, [`\uD83D\uDEAB Member <code>${gid}</code> dinonaktifkan.`]))
			return
		}
		case "/buyer": {
			if (!isAdm) return void tg.sendMessage(chatId, ui.denied())
			const gid = parseInt(args[0], 10)
			const b = await db.getBuyerByTelegram(env.DB, gid)
			if (!b) return void tg.sendMessage(chatId, frame(BRAND, ["Member tidak ditemukan."]))
			await tg.sendMessage(chatId, frame(BRAND, [
				`Nama: <b>${b.name}</b>`,
				`ID: <code>${b.telegram_id}</code>`,
				`Status: ${b.status}`,
				`Aktif sampai: ${fmtDate(b.expired_at)}`,
				`Login web: ${b.email_login || "-"}`,
			]))
			return
		}
		case "/buyerlogin": {
			if (!isAdm) return void tg.sendMessage(chatId, ui.denied())
			const gid = parseInt(args[0], 10)
			const email = args[1]
			const pass = args[2]
			if (Number.isNaN(gid) || !email || !pass)
				return void tg.sendMessage(chatId, frame(BRAND, ["Format: /buyerlogin <id> <email> <password>"]))
			const b = await db.getBuyerByTelegram(env.DB, gid)
			if (!b) return void tg.sendMessage(chatId, frame(BRAND, ["Member tidak ditemukan."]))
			await db.setBuyerLogin(env.DB, b.id, email, await hashPassword(pass), pass)
			await tg.sendMessage(chatId, frame(BRAND, [`\u2705 Login web diset untuk member <code>${gid}</code>.`, `Email: ${email}`]))
			return
		}
		case "/setweblogin": {
			if (!isAdm) return void tg.sendMessage(chatId, ui.denied())
			const email = args[0]
			const pass = args[1]
			if (!email || !pass)
				return void tg.sendMessage(chatId, frame(BRAND, ["Format: /setweblogin <email> <password>"]))
			await db.upsertAdminAccount(env.DB, email, await hashPassword(pass))
			await tg.sendMessage(chatId, frame(BRAND, ["\u2705 Login web admin diset.", `Email: ${email}`]))
			return
		}
		case "/setbrand": {
			if (!isAdm) return void tg.sendMessage(chatId, ui.denied())
			const name = text.slice(cmd.length).trim().replace(/[<>]/g, "")
			if (!name)
				return void tg.sendMessage(chatId, frame(BRAND, ["Format: /setbrand <nama baru>", "Contoh: /setbrand MailVault"]))
			await db.setSetting(env.DB, "brand_name", name)
			setBrand(name)
			await tg.sendMessage(chatId, frame(name, ["\u2705 Nama bot diganti menjadi:", `<b>${name}</b>`]))
			return
		}
		case "/setwelcome": {
			if (!isAdm) return void tg.sendMessage(chatId, ui.denied())
			const wmsg = text.slice(cmd.length).trim()
			if (!wmsg)
				return void tg.sendMessage(chatId, frame(BRAND, ["Format: /setwelcome <teks sambutan>", "Ketik /setwelcome reset untuk kembali ke default."]))
			if (wmsg.toLowerCase() === "reset") {
				await db.setSetting(env.DB, "welcome_text", "")
				setWelcome(null)
				await tg.sendMessage(chatId, frame(BRAND, ["\u2705 Teks sambutan dikembalikan ke default."]))
				return
			}
			await db.setSetting(env.DB, "welcome_text", wmsg)
			setWelcome(wmsg)
			await tg.sendMessage(chatId, frame(BRAND, ["\u2705 Teks sambutan diperbarui.", "", "Pratinjau:", "", wmsg]))
			return
		}
		case "/restore": {
			if (!isAdm) return void tg.sendMessage(chatId, ui.denied())
			await db.setState(env.DB, tid, "restore_wait", {})
			await tg.sendMessage(chatId, frame(BRAND, ["\uD83D\uDCE5 Kirim file backup (.json) untuk restore.", "\u26A0\uFE0F Data sekarang akan ditimpa."]), cancelKb())
			return
		}
		default:
			await tg.sendMessage(chatId, ui.welcome())
	}
}

// ---------- wizard text ----------
async function handleWizardText(
	tg: Telegram,
	env: Env,
	chatId: number,
	tid: number,
	text: string,
	state: db.BotState,
): Promise<void> {
	const draft = state.draft as any
	switch (state.step) {
		// Tambah buyer (admin)
		case "badd_tid": {
			const v = parseInt(text, 10)
			if (Number.isNaN(v)) return void tg.sendMessage(chatId, frame(BRAND, ["ID harus angka. Ulangi."]), cancelKb())
			await db.setState(env.DB, tid, "badd_name", { tid: v })
			await tg.sendMessage(chatId, frame(BRAND, ["Kirim <b>nama</b> member:"]), cancelKb())
			return
		}
		case "badd_name": {
			await db.setState(env.DB, tid, "badd_days", { ...draft, name: text })
			await tg.sendMessage(chatId, frame(BRAND, ["Kirim <b>durasi</b> (jumlah hari):"]), cancelKb())
			return
		}
		case "badd_days": {
			const days = parseInt(text, 10)
			if (Number.isNaN(days)) return void tg.sendMessage(chatId, frame(BRAND, ["Durasi harus angka. Ulangi."]), cancelKb())
			const b = await db.grantBuyer(env.DB, { telegram_id: draft.tid, days, name: draft.name, created_by: tid })
			await db.clearState(env.DB, tid)
			// Login web otomatis: email dari nama @ domain (branding), password random.
			const domain = ((await db.getSetting(env.DB, "web_login_domain")) || "parciv.net").trim() || "parciv.net"
			const slug = String(b.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "")
			const email = (slug || String(b.telegram_id)) + "@" + domain
			const pass = genPassword(10)
			await db.setBuyerLogin(env.DB, b.id, email, await hashPassword(pass), pass)
			const pushed = await notifyBuyer(tg, draft.tid, b.expired_at, { email, password: pass })
			await tg.sendMessage(chatId, frame(BRAND, [
				`\u2705 Member <b>${b.name}</b> berhasil dibuat`,
				`ID: <code>${b.telegram_id}</code>`,
				"Status: \u2705 Langganan aktif",
				`Berlaku sampai: <b>${fmtDate(b.expired_at)}</b>`,
				"",
				"\uD83D\uDD10 Login web (otomatis):",
				`Email: <code>${email}</code>`,
				`Password: <code>${pass}</code>`,
				"",
				pushed ? "\uD83D\uDCE9 Email & password sudah dikirim otomatis ke member." : "\u26A0\uFE0F Member belum /start bot \u2014 kirim manual kredensial di atas.",
			]), adminMenu())
			await backup.createBackup(env, "change", { label: "buyer-baru" }).catch(() => {})
			return
		}
		// Atur IMAP (buyer)
		case "imap_host": {
			await db.setState(env.DB, tid, "imap_security", { host: text })
			await tg.sendMessage(chatId, frame(BRAND, ["Pilih mode keamanan:"]), securityKeyboard())
			return
		}
		case "imap_port": {
			const port = parseInt(text, 10)
			if (Number.isNaN(port)) return void tg.sendMessage(chatId, frame(BRAND, ["Port harus angka. Ulangi."]), cancelKb())
			await db.setState(env.DB, tid, "imap_user", { ...draft, port })
			await tg.sendMessage(chatId, frame(BRAND, ["Kirim <b>username</b> (email login IMAP):"]), cancelKb())
			return
		}
		case "imap_user": {
			await db.setState(env.DB, tid, "imap_pass", { ...draft, user: text })
			await tg.sendMessage(chatId, frame(BRAND, ["Kirim <b>password</b> IMAP:"]), cancelKb())
			return
		}
		case "imap_pass": {
			const buyer = await requireBuyer(env, tid)
			if (!buyer) {
				await db.clearState(env.DB, tid)
				return void tg.sendMessage(chatId, ui.denied())
			}
			await db.setImapForBuyer(env.DB, buyer.id, {
				host: draft.host,
				port: draft.port,
				username: draft.user,
				password: text,
				security: draft.security as ImapSecurity,
			})
			await db.clearState(env.DB, tid)
			await tg.sendMessage(chatId, frame(BRAND, ["\u23F3 IMAP tersimpan. Menguji koneksi..."]))
			const tr = await testImap({ host: draft.host, port: draft.port, user: draft.user, pass: text, security: draft.security as ImapSecurity })
			if (tr.ok) {
				await tg.sendMessage(chatId, frame(BRAND, ["\u2705 Tersimpan & terhubung.", "Tambahkan domain lewat menu Kelola Domain."]), buyerMenu())
			} else {
				await tg.sendMessage(chatId, frame(BRAND, ["\u26A0\uFE0F Tersimpan, tetapi TIDAK terhubung:", tr.error || "gagal", "Periksa host/port/user/password lalu atur ulang."]), buyerMenu())
			}
			await backup.createBackup(env, "change", { label: "imap-update" }).catch(() => {})
			return
		}
		// Tambah domain (buyer)
		case "dom_add": {
			const buyer = await requireBuyer(env, tid)
			if (!buyer) {
				await db.clearState(env.DB, tid)
				return void tg.sendMessage(chatId, ui.denied())
			}
			const imap = await db.getImapForBuyer(env.DB, buyer.id)
			if (!imap) {
				await db.clearState(env.DB, tid)
				return void tg.sendMessage(chatId, frame(BRAND, ["Atur IMAP dulu sebelum menambah domain."]), buyerMenu())
			}
			const domains = db.parseDomains(text)
			const ok: string[] = []
			const bad: string[] = []
			for (const d of domains) {
				const r = await db.addDomain(env.DB, d, buyer.id, imap.id)
				if (r.ok) ok.push(d)
				else bad.push(d)
			}
			await db.clearState(env.DB, tid)
			const lines = [`\u2705 Ditambahkan: ${ok.join(", ") || "-"}`]
			if (bad.length) lines.push(`\u274C Bentrok/dipakai buyer lain: ${bad.join(", ")}`)
			await tg.sendMessage(chatId, frame(BRAND, lines), buyerMenu())
			await backup.createBackup(env, "change", { label: "domain-update" }).catch(() => {})
			return
		}
		// Tambah whitelist user (member)
		case "wl_add": {
			const buyer = await requireBuyer(env, tid)
			if (!buyer) {
				await db.clearState(env.DB, tid)
				return void tg.sendMessage(chatId, ui.denied())
			}
			const parts = text.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)
			const ok: string[] = []
			const bad: string[] = []
			for (const p of parts) {
				const r = await db.addWhitelist(env.DB, buyer.id, p)
				if (r.ok) ok.push(p)
				else bad.push(p)
			}
			await db.clearState(env.DB, tid)
			const lines = ["\u2705 Ditambahkan: " + (ok.join(", ") || "-")]
			if (bad.length) lines.push("\u26A0\uFE0F Dilewati (kosong/duplikat): " + bad.join(", "))
			await tg.sendMessage(chatId, frame(BRAND, lines))
			await sendWhitelist(tg, env, chatId, buyer)
			await backup.createBackup(env, "change", { label: "whitelist-update" }).catch(() => {})
			return
		}
		default:
			await db.clearState(env.DB, tid)
			await tg.sendMessage(chatId, ui.welcome())
	}
}

// ---------- callbacks ----------
async function onCallback(tg: Telegram, env: Env, cq: any): Promise<void> {
	const data: string = cq.data || ""
	const chatId = cq.message.chat.id as number
	const tid = cq.from.id as number
	await tg.answerCallbackQuery(cq.id)

	if (data === "cancel") {
		await db.clearState(env.DB, tid)
		await tg.sendMessage(chatId, frame(BRAND, ["\u274C Dibatalkan."]))
		return
	}

	if (data === "cancel:search") {
		const st = await db.getState(env.DB, tid)
		const email = (st?.draft as any)?.email as string | undefined
		if (email) await db.setState(env.DB, tid, "pending_email", { email })
		else await db.clearState(env.DB, tid)
		const msgId = cq.message?.message_id as number | undefined
		if (email) {
			const priv = await canPrivate(env, tid, email)
			if (msgId) await tg.editMessageText(chatId, msgId, ui.chooseCategory(email, priv), categoryKeyboard(priv))
			else await tg.sendMessage(chatId, ui.chooseCategory(email, priv), categoryKeyboard(priv))
		} else {
			await tg.sendMessage(chatId, ui.welcome())
		}
		return
	}

	// Kategori pencarian — edit pesan yang sama (anti-spam)
	if (data.startsWith("cat:")) {
		const key = data.slice(4) as CategoryKey
		await runSearch(tg, env, chatId, tid, key, cq.message?.message_id)
		return
	}
	if (data === "act:reset") {
		// "Email lain": pesan yang sama diubah jadi permintaan email baru.
		await db.clearState(env.DB, tid)
		const msgId = cq.message?.message_id as number | undefined
		const txt = frame(BRAND, ["\uD83D\uDCE7 Kirim alamat email lain yang ingin dicek."])
		if (msgId) await tg.editMessageText(chatId, msgId, txt)
		else await tg.sendMessage(chatId, txt)
		return
	}
	if (data === "act:again") {
		// "Kategori lain": pesan yang sama kembali ke daftar kategori.
		const st = await db.getState(env.DB, tid)
		const email = (st?.draft as any)?.email
		const msgId = cq.message?.message_id as number | undefined
		if (email) {
			const priv = await canPrivate(env, tid, email)
			if (msgId) await tg.editMessageText(chatId, msgId, ui.chooseCategory(email, priv), categoryKeyboard(priv))
			else await tg.sendMessage(chatId, ui.chooseCategory(email, priv), categoryKeyboard(priv))
		} else {
			if (msgId) await tg.editMessageText(chatId, msgId, ui.welcome())
			else await tg.sendMessage(chatId, ui.welcome())
		}
		return
	}

	// Admin
	if (data.startsWith("adm:")) {
		if (!(await db.isAdmin(env.DB, tid))) return void tg.sendMessage(chatId, ui.denied())
		await handleAdminCallback(tg, env, chatId, tid, data.slice(4))
		return
	}

	// Buyer / IMAP
	if (data.startsWith("by:")) {
		await handleBuyerCallback(tg, env, chatId, tid, data.slice(3))
		return
	}
	if (data.startsWith("sec:")) {
		const sec = data.slice(4) as ImapSecurity
		const st = await db.getState(env.DB, tid)
		if (st?.step === "imap_security") {
			const port = sec === "ssl" ? 993 : 143
			await db.setState(env.DB, tid, "imap_user", { ...(st.draft as any), security: sec, port })
			await tg.sendMessage(chatId, frame(BRAND, [`Mode: ${sec === "ssl" ? "SSL/TLS" : "STARTTLS"} - port ${port} (otomatis)`, "Kirim <b>username</b> (email login IMAP):"]), cancelKb())
		}
		return
	}
	if (data.startsWith("dom:del:")) {
		const buyer = await requireBuyer(env, tid)
		if (!buyer) return
		const domain = data.slice(8)
		await db.removeDomain(env.DB, domain, buyer.id)
		await tg.sendMessage(chatId, frame(BRAND, [`\uD83D\uDDD1\uFE0F Domain ${domain} dihapus.`]))
		return
	}
}

async function handleAdminCallback(
	tg: Telegram,
	env: Env,
	chatId: number,
	tid: number,
	action: string,
): Promise<void> {
	switch (action) {
		case "addbuyer":
			await db.setState(env.DB, tid, "badd_tid", {})
			await tg.sendMessage(chatId, frame(BRAND, ["Kirim <b>Telegram ID</b> member:", "(member harus /start + /myid dulu)"]), cancelKb())
			return
		case "listbuyer": {
			const list = await db.listBuyers(env.DB)
			if (list.length === 0) return void tg.sendMessage(chatId, frame(BRAND, ["Belum ada member."]))
			const shown = list.slice(0, 30)
			const unames = await resolveUsernames(env, shown.map((b) => b.telegram_id))
			const succMap = await db.successCountByBuyer(env.DB)
			const lines: string[] = []
			shown.forEach((b, i) => {
				if (i > 0) lines.push("\u2508\u2508\u2508\u2508\u2508\u2508\u2508\u2508\u2508\u2508")
				const ok = db.isBuyerActive(b)
				const uname = b.telegram_id ? unames[b.telegram_id] : undefined
				lines.push(`\uD83D\uDC64 <b>${b.name}</b>`)
				lines.push(`\uD83D\uDD17 Username : ${uname ? "@" + uname : "\u2014"}`)
				lines.push(`\uD83C\uDD94 ID : <code>${b.telegram_id}</code>`)
				lines.push(`${ok ? "\u2705" : "\u274C"} Valid : ${fmtDate(b.expired_at)}`)
				lines.push(`\uD83C\uDFAF OTP Sukses : ${succMap[b.id] || 0}`)
			})
			await tg.sendMessage(chatId, frame(BRAND, lines))
			return
		}
		case "backupnow": {
			const r = await backup.createBackup(env, "manual", { label: "manual-bot" })
			await tg.sendMessage(chatId, frame(BRAND, [`\uD83D\uDCBE Backup #${r.id} dibuat (${r.rows} baris${r.encrypted ? ", terenkripsi" : ""}).`]))
			return
		}
		case "branding": {
			const cur = (await db.getSetting(env.DB, "brand_name")) || BRAND
			const wel = (await db.getSetting(env.DB, "welcome_text")) || "(default)"
			await tg.sendMessage(chatId, frame(BRAND, [
				"\uD83C\uDFA8 <b>Branding Bot</b>",
				"",
				`Nama sekarang: <b>${cur}</b>`,
				"",
				"Ganti nama bot:",
				"<code>/setbrand Nama Baru</code>",
				"",
				"Ganti teks sambutan:",
				"<code>/setwelcome Teks kamu...</code>",
				"(/setwelcome reset = kembali default)",
				"",
				"Sambutan sekarang:",
				wel,
			]))
			return
		}
	}
}

async function handleBuyerCallback(
	tg: Telegram,
	env: Env,
	chatId: number,
	tid: number,
	action: string,
): Promise<void> {
	const buyer = await requireBuyer(env, tid)
	if (!buyer) return void tg.sendMessage(chatId, ui.denied())

	if (action.startsWith("wldel:")) {
		const wid = parseInt(action.slice(6), 10)
		if (!Number.isNaN(wid)) await db.removeWhitelist(env.DB, buyer.id, wid)
		await sendWhitelist(tg, env, chatId, buyer)
		return
	}

	switch (action) {
		case "menu":
			await tg.sendMessage(chatId, frame(BRAND, ["\uD83D\uDC64 Menu Member"]), buyerMenu())
			return
		case "wl":
			await sendWhitelist(tg, env, chatId, buyer)
			return
		case "wladd":
			await db.setState(env.DB, tid, "wl_add", {})
			await tg.sendMessage(chatId, frame(BRAND, ["Kirim <b>@username</b> atau <b>ID Telegram</b> user yang diizinkan.", "Boleh banyak (pisah koma/spasi/baris)."]), cancelKb())
			return
		case "setimap":
			await db.setState(env.DB, tid, "imap_host", {})
			await tg.sendMessage(chatId, frame(BRAND, ["Kirim <b>host</b> IMAP:", "contoh: imap.domainmu.com"]), cancelKb())
			return
		case "domains": {
			const domains = await db.listDomainsForBuyer(env.DB, buyer.id)
			const lines = domains.length
				? domains.map((d) => `\u2022 ${d.domain}`)
				: ["Belum ada domain."]
			const kb: InlineButton[][] = [[{ text: "\u2795 Tambah Domain", callback_data: "by:domadd" }]]
			for (const d of domains.slice(0, 10))
				kb.push([{ text: `\uD83D\uDDD1\uFE0F ${d.domain}`, callback_data: `dom:del:${d.domain}` }])
			await tg.sendMessage(chatId, frame(BRAND, ["\uD83C\uDF10 <b>Domain kamu</b>", ...lines]), kb)
			return
		}
		case "domadd":
			await db.setState(env.DB, tid, "dom_add", {})
			await tg.sendMessage(chatId, frame(BRAND, ["Kirim domain (boleh banyak: koma, spasi, atau baris baru):", "URL/email otomatis dideteksi", "contoh: parciv.net, woi.lol"]), cancelKb())
			return
		case "test": {
			const imap = await db.getImapForBuyer(env.DB, buyer.id)
			if (!imap) return void tg.sendMessage(chatId, frame(BRAND, ["IMAP belum diatur."]))
			await tg.sendMessage(chatId, frame(BRAND, ["\u23F3 Menguji koneksi..."]))
			try {
				const client = new ImapClient({ host: imap.host, port: imap.port, user: imap.username, pass: imap.password, security: imap.security })
				await client.connectAndLogin()
				await client.selectInbox()
				await client.logout()
				await tg.sendMessage(chatId, frame(BRAND, ["\u2705 Koneksi IMAP berhasil."]))
			} catch (e: any) {
				await tg.sendMessage(chatId, frame(BRAND, ["\u274C Gagal:", String(e?.message || e).slice(0, 200)]))
			}
			return
		}
		case "status": {
			const imap = await db.getImapForBuyer(env.DB, buyer.id)
			const domains = await db.listDomainsForBuyer(env.DB, buyer.id)
			const daysLeft = buyer.expired_at ? Math.ceil((Date.parse(buyer.expired_at) - Date.now()) / 86400000) : null
			const domLines = domains.length ? domains.map((d) => `\u2022 ${d.domain}`) : ["(belum ada domain)"]
			const lines = [
				`Nama: <b>${buyer.name}</b>`,
				`Status: ${db.isBuyerActive(buyer) ? "\u2705 Aktif" : "\u274C Nonaktif"}`,
				`Aktif sampai: ${fmtDate(buyer.expired_at)}`,
			]
			if (daysLeft !== null) lines.push(`Sisa: <b>${daysLeft > 0 ? daysLeft + " hari" : "habis"}</b>`)
			lines.push(`IMAP: ${imap ? imap.host : "belum diatur"}`)
			lines.push(`Domain (${domains.length}):`)
			lines.push(...domLines)
			await tg.sendMessage(chatId, frame(BRAND, lines))
			return
		}
	}
}

// ---------- pencarian ----------
async function runSearch(
	tg: Telegram,
	env: Env,
	chatId: number,
	tid: number,
	key: CategoryKey,
	srcMsgId?: number,
): Promise<void> {
	// Bila dipicu dari tombol, edit pesan yang sama (anti-spam); kirim baru bila tidak ada.
	const out = (text: string, kb?: InlineButton[][]) =>
		srcMsgId
			? tg.editMessageText(chatId, srcMsgId, text, kb)
			: tg.sendMessage(chatId, text, kb)
	const cat = CATEGORIES[key]
	if (!cat) return
	if (!cat.public && !(await privileged(env, tid))) {
		await out(ui.denied())
		return
	}
	const st = await db.getState(env.DB, tid)
	const email = (st?.draft as any)?.email as string | undefined
	if (!email) return void out(ui.welcome())

	// rate limit
	const limit = parseInt(env.RATE_LIMIT_PER_MIN || "10", 10)
	if ((await db.countRecentSearches(env.DB, tid, 60)) >= limit) {
		await out(ui.rateLimited())
		return
	}

	const domain = email.split("@")[1]
	const owner = await db.getDomainOwner(env.DB, domain)
	if (!owner) return void out(ui.domainNotFound(domain))
	// Whitelist pemilik domain: blokir user yang tidak diizinkan (kosong = terbuka).
	if (!(await whitelistAllows(env, tid, email))) return void out(ui.denied())
	// Kategori privat (Reset Email/Password) hanya untuk pemilik domain atau admin.
	if (!cat.public) {
		const isAdm = await db.isAdmin(env.DB, tid)
		const meBuyer = await db.getBuyerByTelegram(env.DB, tid)
		const ownsDomain = meBuyer != null && owner.buyer_id === meBuyer.id
		if (!isAdm && !ownsDomain) return void out(ui.denied())
	}
	const imap = await db.getImapById(env.DB, owner.imap_server_id)
	if (!imap) return void out(ui.notConfigured())

	const lookback = parseInt(env.SEARCH_LOOKBACK || "30", 10)
	const intervalMs = parseInt(env.AUTO_REFRESH_MS || "5000", 10)
	const maxTries = parseInt(env.AUTO_REFRESH_MAX || "5", 10)

	// Tandai sesi pencarian; tombol Batalkan menghentikan auto-refresh.
	const sid = Date.now()
	await db.setState(env.DB, tid, "pending_email", { email, searchSid: sid })

	// Pakai pesan kategori yang sama agar tidak spam; kirim baru hanya bila perlu.
	let msgId: number | undefined = srcMsgId
	if (msgId) {
		await tg.editMessageText(chatId, msgId, ui.searching(cat.label), cancelSearchKeyboard())
	} else {
		const sent: any = await tg.sendMessage(chatId, ui.searching(cat.label), cancelSearchKeyboard())
		msgId = sent?.result?.message_id
	}

	const stillActive = async (): Promise<boolean> => {
		const cur = await db.getState(env.DB, tid)
		return (cur?.draft as any)?.searchSid === sid
	}

	for (let attempt = 1; attempt <= maxTries; attempt++) {
		let found = false
		let value: string | undefined
		let date: string | undefined
		let kind: "code" | "link" = cat.kind
		let backupLink: string | undefined
		try {
			const messages = await fetchMessages(imap, email, lookback)
			const hit = findLatest(messages, key)
			found = !!(hit.found && hit.value)
			value = hit.value
			date = fmtWib(hit.date, parseInt(env.TZ_OFFSET || "7", 10))
			// Household: email hanya berisi link "Dapatkan Kode" -> ikuti otomatis & ambil kode 4 digit.
			if (found && key === "household" && value) {
				const code = await fetchHouseholdCode(value)
				if (code) {
					backupLink = value
					value = code
					kind = "code"
				}
			}
		} catch (e) {
			await db.logSearch(env.DB, tid, email, key, "error")
			if (await stillActive()) {
				if (msgId) await tg.editMessageText(chatId, msgId, ui.searchError(), notFoundKeyboard(key))
				else await tg.sendMessage(chatId, ui.searchError(), notFoundKeyboard(key))
			}
			return
		}

		if (!(await stillActive())) return

		if (found) {
			await db.logSearch(env.DB, tid, email, key, "found")
			const txt = ui.found(cat.label, kind, value as string, date, backupLink)
			if (msgId) await tg.editMessageText(chatId, msgId, txt, foundKeyboard())
			else await tg.sendMessage(chatId, txt, foundKeyboard())
			return
		}

		if (attempt >= maxTries) {
			await db.logSearch(env.DB, tid, email, key, "notfound")
			const txt = ui.notFound(cat.label) + "  ⏹️ Auto-refresh berhenti. Tekan Cek lagi bila perlu."
			if (msgId) await tg.editMessageText(chatId, msgId, txt, notFoundKeyboard(key))
			else await tg.sendMessage(chatId, txt, notFoundKeyboard(key))
			return
		}

		const waitTxt = frame(BRAND, [
			"⏳ Menunggu email <b>" + cat.label + "</b> masuk...",
			"Auto cek tiap " + Math.round(intervalMs / 1000) + " detik (cek ke-" + attempt + "/" + maxTries + ").",
			"",
			"Tekan Batalkan untuk kembali memilih kategori.",
		])
		if (msgId) await tg.editMessageText(chatId, msgId, waitTxt, cancelSearchKeyboard())
		await sleep(intervalMs)
		if (!(await stillActive())) return
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms))
}

export async function fetchMessages(
	imap: db.ImapServer,
	email: string,
	_lookbackDays: number,
): Promise<RawMessage[]> {
	const client = new ImapClient({
		host: imap.host,
		port: imap.port,
		user: imap.username,
		pass: imap.password,
		security: imap.security,
	})
	await client.connectAndLogin()
	try {
		await client.selectInbox()
		const uids = await client.searchNetflixTo(email)
		const latest = uids.sort((a, b) => b - a).slice(0, 8)
		const out: RawMessage[] = []
		for (const uid of latest) out.push(await client.fetchRaw(uid))
		return out
	} finally {
		await client.logout()
	}
}

// ---------- restore via file ----------
async function handleDocument(
	tg: Telegram,
	env: Env,
	chatId: number,
	tid: number,
	document: any,
): Promise<void> {
	const st = await db.getState(env.DB, tid)
	if (st?.step !== "restore_wait" || !(await db.isAdmin(env.DB, tid))) return
	try {
		const f = await tg.getFile(document.file_id)
		const path = f?.result?.file_path
		if (!path) throw new Error("file_path kosong")
		const content = await tg.downloadFile(path)
		const n = await backup.restoreFromJson(env, content)
		await db.clearState(env.DB, tid)
		await tg.sendMessage(chatId, frame(BRAND, [`\u2705 Restore selesai. ${n} baris dipulihkan.`]))
	} catch (e: any) {
		await tg.sendMessage(chatId, frame(BRAND, ["\u274C Restore gagal:", String(e?.message || e).slice(0, 200)]))
	}
}

// ---------- utils ----------
async function sendWhitelist(tg: Telegram, env: Env, chatId: number, buyer: db.Buyer): Promise<void> {
	const list = await db.listWhitelist(env.DB, buyer.id)
	// Resolve @username dari ID (via bot_users / getChat) supaya entri ber-ID tampil sebagai @username.
	const unames = await resolveUsernames(env, list.map((w) => w.telegram_id))
	const label = (w: db.WhitelistEntry): string => {
		const u = w.username || (w.telegram_id != null ? unames[w.telegram_id] || null : null)
		return u ? "@" + u : "ID " + w.telegram_id
	}
	const lines = ["\uD83D\uDD10 <b>Whitelist User</b>"]
	if (!list.length) {
		lines.push("Kosong \u2014 semua orang boleh akses domainmu.")
	} else {
		lines.push("Hanya user berikut yang boleh akses:")
		for (const w of list) lines.push("\u2022 " + label(w))
	}
	const kb: InlineButton[][] = [[{ text: "\u2795 Tambah User", callback_data: "by:wladd" }]]
	for (const w of list.slice(0, 15))
		kb.push([{ text: "\uD83D\uDDD1\uFE0F " + label(w), callback_data: "by:wldel:" + w.id }])
	await tg.sendMessage(chatId, frame(BRAND, lines), kb)
}

async function requireBuyer(env: Env, tid: number): Promise<db.Buyer | null> {
	const b = await db.getBuyerByTelegram(env.DB, tid)
	if (db.isBuyerActive(b)) return b
	// admin juga boleh kelola IMAP miliknya sendiri sebagai buyer? -> buat buyer bayangan utk admin
	if (await db.isAdmin(env.DB, tid)) {
		if (b) return b
		return db.grantBuyer(env.DB, { telegram_id: tid, days: 3650, name: "Admin" })
	}
	return null
}

async function notifyBuyer(tg: Telegram, gid: number, expiredAt: string | null, login?: { email: string; password: string; url?: string }): Promise<boolean> {
	const lines = ["\uD83C\uDF89 Langganan kamu aktif!", "Status: \u2705 Aktif", `Berlaku sampai: <b>${fmtDate(expiredAt)}</b>`]
	if (login) {
		lines.push("", "\uD83D\uDD10 Login web kamu:", `Email: <b>${login.email}</b>`, `Password: <code>${login.password}</code>`)
		if (login.url) lines.push(`Buka: ${login.url}`)
		lines.push("Simpan baik-baik, jangan dibagikan.")
	} else {
		lines.push("", "Ketik /menu untuk mulai memakai layanan.", "Butuh login web? Minta detailnya ke admin.")
	}
	try {
		await tg.sendMessage(gid, frame(BRAND, lines))
		return true
	} catch {
		return false
	}
}

function fmtDate(iso: string | null): string {
	if (!iso) return "-"
	return iso.slice(0, 16).replace("T", " ")
}

// Format tanggal email ke zona waktu lokal (WIB/WITA/WIT) untuk ditampilkan ke user.
export function fmtWib(iso: string | null | undefined, offset: number): string | undefined {
	if (!iso) return undefined
	const t = Date.parse(iso)
	if (Number.isNaN(t)) return iso
	const d = new Date(t + offset * 3600000)
	const pad = (n: number) => String(n).padStart(2, "0")
	const M = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
	const lbl = offset === 7 ? "WIB" : offset === 8 ? "WITA" : offset === 9 ? "WIT" : "GMT+" + offset
	return `${pad(d.getUTCDate())} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} ${lbl}`
}

// Dipakai dari web.ts saat admin membuat buyer lewat dashboard.
export async function notifyNewBuyer(env: Env, gid: number, expiredAt: string | null, login?: { email: string; password: string; url?: string }): Promise<boolean> {
	const tg = new Telegram(env.BOT_TOKEN)
	await loadBranding(env)
	return notifyBuyer(tg, gid, expiredAt, login)
}

// Dipakai dari cron (index.ts) untuk mengingatkan buyer menjelang masa habis.
export async function remindExpiry(env: Env, gid: number, daysLeft: number, expiredAt: string | null): Promise<void> {
	const tg = new Telegram(env.BOT_TOKEN)
	await loadBranding(env)
	try {
		await tg.sendMessage(gid, frame(BRAND, ["\u23F0 Pengingat langganan", `Langganan kamu akan berakhir dalam <b>${daysLeft} hari</b>.`, `Berlaku sampai: <b>${fmtDate(expiredAt)}</b>`, "", "Hubungi admin untuk perpanjang."]))
	} catch {
		/* buyer belum /start - abaikan */
	}
}

// Dipakai dari cron (index.ts) saat masa aktif benar-benar habis (H-0).
export async function notifyExpired(env: Env, gid: number, expiredAt: string | null): Promise<void> {
	const tg = new Telegram(env.BOT_TOKEN)
	await loadBranding(env)
	try {
		await tg.sendMessage(gid, frame(BRAND, ["\u26A0\uFE0F Langganan kamu sudah berakhir.", `Masa aktif habis pada: <b>${fmtDate(expiredAt)}</b>`, "", "Hubungi admin untuk memperpanjang \uD83D\uDE4F"]))
	} catch {
		/* buyer belum /start - abaikan */
	}
}
