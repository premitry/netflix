// Dashboard web (dark mode) + API. Login email+password, dipakai admin & buyer.
import type { Env } from "./env"
import * as db from "./db"
import { verifyPassword, hashPassword, randomToken, genPassword } from "./auth"
import { fetchMessages, notifyNewBuyer, resolveUsernames, fmtWib } from "./bot"
import { CATEGORIES, fetchHouseholdCode, findLatest, type CategoryKey } from "./netflix"
import { testImap } from "./imap"
import * as backup from "./backup"
import { LOGIN_HTML, APP_HTML } from "./html"

const COOKIE = "nv_session"

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json", ...headers },
	})
}

function html(body: string): Response {
	return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } })
}

// Sisipkan nama brand kustom ke HTML (placeholder __BRAND__).
async function brandHtml(env: Env, page: string): Promise<string> {
	const brand = ((await db.getSetting(env.DB, "brand_name")) || "\u26A1 FLIXVAULT").replace(/[<>]/g, "")
	return page.split("__BRAND__").join(brand)
}

function getCookie(req: Request, name: string): string | null {
	const raw = req.headers.get("Cookie") || ""
	const m = raw.match(new RegExp(`(?:^|; )${name}=([^;]+)`))
	return m ? decodeURIComponent(m[1]) : null
}

async function session(req: Request, env: Env): Promise<db.Session | null> {
	const token = getCookie(req, COOKIE)
	if (!token) return null
	return db.getSession(env.DB, token)
}

export async function handleWeb(req: Request, env: Env, url: URL): Promise<Response> {
	const path = url.pathname
	const method = req.method

	// Halaman
	const APP_PATHS = ["/", "/dashboard", "/search", "/member", "/backup", "/branding", "/imap"]
	if (method === "GET" && APP_PATHS.includes(path)) {
		const s = await session(req, env)
		const page = s ? APP_HTML : LOGIN_HTML
		return html(await brandHtml(env, page))
	}
	if (method === "GET" && path === "/login") return html(await brandHtml(env, LOGIN_HTML))

	// API
	if (path === "/api/login" && method === "POST") return apiLogin(req, env)
	if (path === "/api/logout" && method === "POST") return apiLogout(req, env)

	const s = await session(req, env)
	if (!s) return json({ error: "unauthorized" }, 401)

	switch (`${method} ${path}`) {
		case "GET /api/me":
			return apiMe(env, s)
		case "POST /api/search":
			return apiSearch(req, env, s)
		case "GET /api/imap":
			return apiGetImap(env, s, url)
		case "POST /api/imap":
			return apiSetImap(req, env, s)
		case "GET /api/domains":
			return apiGetDomains(env, s, url)
		case "POST /api/domains":
			return apiAddDomains(req, env, s)
		case "POST /api/domains/remove":
			return apiRemoveDomain(req, env, s)
		case "POST /api/domains/set":
			return apiSetDomains(req, env, s)
		case "GET /api/buyers":
			return apiListBuyers(env, s)
		case "POST /api/buyers":
			return apiCreateBuyer(req, env, s)
		case "POST /api/buyers/login":
			return apiSetBuyerLogin(req, env, s)
		case "POST /api/buyers/revoke":
			return apiRevokeBuyer(req, env, s)
		case "POST /api/buyers/delete":
			return apiDeleteBuyer(req, env, s)
		case "POST /api/buyers/resetpw":
			return apiResetBuyerPw(req, env, s)
		case "POST /api/buyers/detail":
			return apiBuyerDetail(req, env, s)
		case "POST /api/buyers/reactivate":
			return apiReactivateBuyer(req, env, s)
		case "POST /api/buyers/update":
			return apiUpdateBuyer(req, env, s)
		case "POST /api/buyers/whitelist":
			return apiListWhitelist(req, env, s)
		case "POST /api/buyers/whitelist/add":
			return apiAddWhitelist(req, env, s)
		case "POST /api/buyers/whitelist/remove":
			return apiRemoveWhitelist(req, env, s)
		case "GET /api/audit":
			return apiListAudit(env, s)
		case "GET /api/backups":
			return apiListBackups(env, s)
		case "POST /api/backups":
			return apiCreateBackup(env, s)
		case "POST /api/restore":
			return apiRestore(req, env, s)
		case "POST /api/restore/file":
			return apiRestoreFile(req, env, s)
		case "POST /api/backups/test":
			return apiTestBackup(env, s)
		case "GET /api/backups/download":
			return apiDownloadBackup(env, s, url)
		case "GET /api/db/stats":
			return apiDbStats(env, s)
		case "GET /api/stats":
			return apiStats(env, s)
		case "GET /api/settings/backup":
			return apiGetBackupSettings(env, s)
		case "POST /api/settings/backup":
			return apiSetBackupSettings(req, env, s)
		case "GET /api/settings/brand":
			return apiGetBrand(env, s)
		case "POST /api/settings/brand":
			return apiSetBrand(req, env, s)
	}
	return json({ error: "not_found" }, 404)
}

function requireAdmin(s: db.Session): boolean {
	return s.is_admin === 1
}

// ---------- auth ----------
async function apiLogin(req: Request, env: Env): Promise<Response> {
	const { email, password } = (await req.json().catch(() => ({}))) as any
	if (!email || !password) return json({ error: "missing" }, 400)
	const ttl = parseInt(env.SESSION_TTL_HOURS || "168", 10)

	// admin dulu
	const admin = await db.getAdminAccountByEmail(env.DB, email)
	if (admin && (await verifyPassword(password, admin.password_hash))) {
		const token = randomToken()
		await db.createSession(env.DB, token, { isAdmin: true, ttlHours: ttl })
		return json({ ok: true, role: "admin" }, 200, cookieHeader(token, ttl))
	}

	// buyer
	const buyer = await db.getBuyerByEmail(env.DB, email)
	if (buyer && buyer.password_hash && (await verifyPassword(password, buyer.password_hash))) {
		if (!db.isBuyerActive(buyer)) return json({ error: "expired" }, 403)
		const token = randomToken()
		await db.createSession(env.DB, token, { buyerId: buyer.id, isAdmin: false, ttlHours: ttl })
		return json({ ok: true, role: "buyer" }, 200, cookieHeader(token, ttl))
	}
	return json({ error: "invalid" }, 401)
}

function cookieHeader(token: string, ttlHours: number): Record<string, string> {
	return {
		"Set-Cookie": `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ttlHours * 3600}`,
	}
}

async function apiLogout(req: Request, env: Env): Promise<Response> {
	const token = getCookie(req, COOKIE)
	if (token) await db.deleteSession(env.DB, token)
	return json({ ok: true }, 200, {
		"Set-Cookie": `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
	})
}

async function apiMe(env: Env, s: db.Session): Promise<Response> {
	if (s.is_admin) return json({ role: "admin" })
	const b = s.buyer_id ? await db.getBuyerById(env.DB, s.buyer_id) : null
	return json({
		role: "buyer",
		name: b?.name,
		expired_at: b?.expired_at,
		email: b?.email_login,
	})
}

// ---------- search ----------
async function apiSearch(req: Request, env: Env, s: db.Session): Promise<Response> {
	const { email, category } = (await req.json().catch(() => ({}))) as any
	if (!email || !category) return json({ error: "missing" }, 400)
	const cat = CATEGORIES[category as CategoryKey]
	if (!cat) return json({ error: "bad_category" }, 400)
	// semua user web (admin/buyer) berhak kategori privat
	const domain = String(email).toLowerCase().split("@")[1]
	if (!domain) return json({ error: "bad_email" }, 400)
	const owner = await db.getDomainOwner(env.DB, domain)
	if (!owner) return json({ error: "domain_not_found" }, 404)
	// buyer hanya boleh cari domain miliknya
	if (!s.is_admin && owner.buyer_id !== s.buyer_id)
		return json({ error: "forbidden" }, 403)
	const imap = await db.getImapById(env.DB, owner.imap_server_id)
	if (!imap) return json({ error: "no_imap" }, 400)
	try {
		const messages = await fetchMessages(imap, String(email).toLowerCase(), 30)
		const hit = findLatest(messages, category as CategoryKey)
		let value = hit.value
		let kind = cat.kind
		let backupLink: string | undefined
		// Household: ikuti link "Dapatkan Kode" & ambil kode 4 digit otomatis.
		if (hit.found && hit.value && category === "household") {
			const code = await fetchHouseholdCode(hit.value)
			if (code) {
				backupLink = hit.value
				value = code
				kind = "code"
			}
		}
		await db.logSearch(env.DB, null, String(email).toLowerCase(), category, hit.found ? "found" : "notfound")
		return json({ ok: true, found: hit.found, value, kind, label: cat.label, date: fmtWib(hit.date, parseInt(env.TZ_OFFSET || "7", 10)), backupLink })
	} catch (e: any) {
		return json({ error: "imap_error", detail: String(e?.message || e) }, 502)
	}
}

// ---------- imap (buyer) ----------
async function buyerIdOf(env: Env, s: db.Session): Promise<number | null> {
	if (s.buyer_id) return s.buyer_id
	return null
}

// Admin boleh menargetkan buyer lain lewat tid (query "tid" atau body "target_tid").
// Selain admin, selalu pakai buyer dari sesi.
async function resolveBuyerId(env: Env, s: db.Session, tidRaw: unknown): Promise<number | null> {
	if (requireAdmin(s) && tidRaw != null && String(tidRaw).trim() !== "") {
		const b = await db.getBuyerByTelegram(env.DB, parseInt(String(tidRaw), 10))
		return b ? b.id : null
	}
	return buyerIdOf(env, s)
}

async function apiGetImap(env: Env, s: db.Session, url: URL): Promise<Response> {
	const bid = await resolveBuyerId(env, s, url.searchParams.get("tid"))
	if (!bid) return json({ imap: null })
	const imap = await db.getImapForBuyer(env.DB, bid)
	if (!imap) return json({ imap: null })
	return json({ imap: { host: imap.host, port: imap.port, username: imap.username, security: imap.security } })
}

async function apiSetImap(req: Request, env: Env, s: db.Session): Promise<Response> {
	const body = (await req.json().catch(() => ({}))) as any
	const bid = await resolveBuyerId(env, s, body.target_tid)
	if (!bid) return json({ error: "buyer_only" }, 403)
	if (!body.host || !body.username || !body.password) return json({ error: "missing" }, 400)
	const port = parseInt(body.port, 10) || (body.security === "starttls" ? 143 : 993)
	const security: "starttls" | "ssl" = body.security === "starttls" ? "starttls" : "ssl"
	await db.setImapForBuyer(env.DB, bid, {
		host: String(body.host),
		port,
		username: String(body.username),
		password: String(body.password),
		security,
	})
	await backup.createBackup(env, "change", { label: "imap-web" }).catch(() => {})
	// Langsung uji koneksi agar user tahu connected / not connected.
	const test = await testImap({
		host: String(body.host),
		port,
		user: String(body.username),
		pass: String(body.password),
		security,
	})
	return json({ ok: true, connected: test.ok, error: test.error })
}

async function apiGetDomains(env: Env, s: db.Session, url: URL): Promise<Response> {
	const bid = await resolveBuyerId(env, s, url.searchParams.get("tid"))
	if (!bid) return json({ domains: [] })
	const domains = await db.listDomainsForBuyer(env.DB, bid)
	return json({ domains: domains.map((d) => d.domain) })
}

async function apiAddDomains(req: Request, env: Env, s: db.Session): Promise<Response> {
	const body = (await req.json().catch(() => ({}))) as any
	const bid = await resolveBuyerId(env, s, body.target_tid)
	if (!bid) return json({ error: "buyer_only" }, 403)
	const imap = await db.getImapForBuyer(env.DB, bid)
	if (!imap) return json({ error: "no_imap" }, 400)
	const list = db.parseDomains(body.domains)
	const ok: string[] = []
	const bad: string[] = []
	for (const d of list) {
		const r = await db.addDomain(env.DB, d, bid, imap.id)
		if (r.ok) ok.push(d)
		else bad.push(d)
	}
	await backup.createBackup(env, "change", { label: "domain-web" }).catch(() => {})
	return json({ ok: true, added: ok, conflict: bad })
}

async function apiRemoveDomain(req: Request, env: Env, s: db.Session): Promise<Response> {
	const body = (await req.json().catch(() => ({}))) as any
	const bid = await resolveBuyerId(env, s, body.target_tid)
	if (!bid) return json({ error: "buyer_only" }, 403)
	if (!body.domain) return json({ error: "missing" }, 400)
	await db.removeDomain(env.DB, String(body.domain), bid)
	return json({ ok: true })
}

// Sinkronkan domain: simpan = set persis sesuai daftar di textarea.
// Domain yang dihapus dari teks akan dihapus; yang baru ditambahkan.
async function apiSetDomains(req: Request, env: Env, s: db.Session): Promise<Response> {
	const body = (await req.json().catch(() => ({}))) as any
	const bid = await resolveBuyerId(env, s, body.target_tid)
	if (!bid) return json({ error: "buyer_only" }, 403)
	const imap = await db.getImapForBuyer(env.DB, bid)
	if (!imap) return json({ error: "no_imap" }, 400)
	const wanted = db.parseDomains(body.domains)
	const wantedSet = new Set(wanted)
	const current = (await db.listDomainsForBuyer(env.DB, bid)).map((d) => d.domain)
	const currentSet = new Set(current)
	const removed: string[] = []
	for (const d of current) {
		if (!wantedSet.has(d)) {
			await db.removeDomain(env.DB, d, bid)
			removed.push(d)
		}
	}
	const added: string[] = []
	const conflict: string[] = []
	for (const d of wanted) {
		if (!currentSet.has(d)) {
			const r = await db.addDomain(env.DB, d, bid, imap.id)
			if (r.ok) added.push(d)
			else conflict.push(d)
		}
	}
	await backup.createBackup(env, "change", { label: "domain-web" }).catch(() => {})
	const finalList = (await db.listDomainsForBuyer(env.DB, bid)).map((d) => d.domain)
	return json({ ok: true, domains: finalList, added, removed, conflict })
}

// ---------- admin ----------
async function apiListBuyers(env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const list = await db.listBuyers(env.DB)
	const unames = await resolveUsernames(env, list.map((b) => b.telegram_id))
	const succMap = await db.successCountByBuyer(env.DB)
	const buyers = await Promise.all(
		list.map(async (b) => ({
			id: b.id,
			telegram_id: b.telegram_id,
			name: b.name,
			username: b.telegram_id ? unames[b.telegram_id] || "" : "",
			email: b.email_login,
			domains: (await db.listDomainsForBuyer(env.DB, b.id)).map((d) => d.domain),
			password: b.password_plain,
			status: b.status,
			expired_at: b.expired_at,
			active: db.isBuyerActive(b),
			is_admin: b.telegram_id ? await db.isAdmin(env.DB, b.telegram_id) : false,
			otpSuccess: succMap[b.id] || 0,
		})),
	)
	return json({ buyers })
}

async function apiCreateBuyer(req: Request, env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const body = (await req.json().catch(() => ({}))) as any
	const tid = parseInt(body.telegram_id, 10)
	const days = parseInt(body.days, 10)
	if (Number.isNaN(tid) || Number.isNaN(days)) return json({ error: "bad_input" }, 400)
	const b = await db.grantBuyer(env.DB, { telegram_id: tid, days, name: body.name || undefined })
	// Selalu buat login web: pakai email yang diisi, atau bangun dari nama @ domain (branding).
	const domain = ((await db.getSetting(env.DB, "web_login_domain")) || "parciv.net").trim() || "parciv.net"
	let email = body.email && String(body.email).trim() ? String(body.email).trim().toLowerCase() : ""
	if (!email) {
		const base = String(body.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "")
		email = (base || String(tid)) + "@" + domain
	}
	const pass = body.password && String(body.password).trim() ? String(body.password) : genPassword(10)
	await db.setBuyerLogin(env.DB, b.id, email, await hashPassword(pass), pass)
	const login = { email, password: pass }
	await db.addAudit(env.DB, "admin", "create", String(tid), body.name || "").catch(() => {})
	await backup.createBackup(env, "change", { label: "buyer-web" }).catch(() => {})
	// Push langganan + kredensial login ke buyer via Telegram.
	let pushed = false
	if (env.BOT_TOKEN && b.telegram_id) {
		let loginUrl: string | undefined
		try {
			loginUrl = new URL(req.url).origin + "/login"
		} catch {
			loginUrl = undefined
		}
		pushed = await notifyNewBuyer(env, b.telegram_id, b.expired_at, { email, password: pass, url: loginUrl }).catch(() => false)
	}
	return json({ ok: true, buyer: { id: b.id, telegram_id: b.telegram_id, expired_at: b.expired_at }, login, pushed })
}

async function apiSetBuyerLogin(req: Request, env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const body = (await req.json().catch(() => ({}))) as any
	const tid = parseInt(body.telegram_id, 10)
	if (Number.isNaN(tid) || !body.email || !body.password) return json({ error: "bad_input" }, 400)
	const b = await db.getBuyerByTelegram(env.DB, tid)
	if (!b) return json({ error: "not_found" }, 404)
	await db.setBuyerLogin(env.DB, b.id, String(body.email), await hashPassword(String(body.password)), String(body.password))
	return json({ ok: true })
}

async function apiRevokeBuyer(req: Request, env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const body = (await req.json().catch(() => ({}))) as any
	const tid = parseInt(body.telegram_id, 10)
	const b = await db.getBuyerByTelegram(env.DB, tid)
	if (!b) return json({ error: "not_found" }, 404)
	await db.revokeBuyer(env.DB, b.id)
	await db.addAudit(env.DB, "admin", "suspend", String(tid), b.name).catch(() => {})
	return json({ ok: true })
}

async function apiDeleteBuyer(req: Request, env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const body = (await req.json().catch(() => ({}))) as any
	const tid = parseInt(body.telegram_id, 10)
	const b = await db.getBuyerByTelegram(env.DB, tid)
	if (!b) return json({ error: "not_found" }, 404)
	await db.deleteBuyer(env.DB, b.id)
	await db.addAudit(env.DB, "admin", "delete", String(tid), b.name).catch(() => {})
	await backup.createBackup(env, "change", { label: "buyer-delete" }).catch(() => {})
	return json({ ok: true })
}

async function apiResetBuyerPw(req: Request, env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const body = (await req.json().catch(() => ({}))) as any
	const tid = parseInt(body.telegram_id, 10)
	const b = await db.getBuyerByTelegram(env.DB, tid)
	if (!b) return json({ error: "not_found" }, 404)
	if (!b.email_login) return json({ error: "no_login" }, 400)
	const pw = genPassword(10)
	await db.setBuyerLogin(env.DB, b.id, b.email_login, await hashPassword(pw), pw)
	await db.addAudit(env.DB, "admin", "resetpw", String(tid), b.email_login).catch(() => {})
	return json({ ok: true, email: b.email_login, password: pw })
}

// Edit profil buyer (Kelola): nama, telegram_id, email login, opsional password baru.
async function apiUpdateBuyer(req: Request, env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const body = (await req.json().catch(() => ({}))) as any
	const id = parseInt(body.id, 10)
	if (Number.isNaN(id)) return json({ error: "bad_input" }, 400)
	const b = await db.getBuyerById(env.DB, id)
	if (!b) return json({ error: "not_found" }, 404)
	const name = String(body.name || "").trim()
	if (!name) return json({ error: "name_required" }, 400)
	// Telegram ID baru (boleh dikosongkan = null)
	let tid: number | null = b.telegram_id
	if (body.telegram_id !== undefined) {
		const raw = String(body.telegram_id).trim()
		if (!raw) {
			tid = null
		} else {
			const nt = parseInt(raw, 10)
			if (Number.isNaN(nt)) return json({ error: "bad_tid" }, 400)
			tid = nt
		}
	}
	if (tid !== null && tid !== b.telegram_id) {
		const other = await db.getBuyerByTelegram(env.DB, tid)
		if (other && other.id !== id) return json({ error: "tid_taken" }, 409)
	}
	// Email login baru (boleh dikosongkan = null)
	let email: string | null = b.email_login
	if (body.email !== undefined) {
		const e = String(body.email || "").trim().toLowerCase()
		email = e || null
	}
	if (email && email !== (b.email_login || "")) {
		const other = await db.getBuyerByEmail(env.DB, email)
		if (other && other.id !== id) return json({ error: "email_taken" }, 409)
	}
	let passwordHash: string | undefined
	let plainPw: string | undefined
	if (body.password && String(body.password).trim()) {
		passwordHash = await hashPassword(String(body.password))
		plainPw = String(body.password)
	}
	await db.updateBuyer(env.DB, id, { name, telegram_id: tid, email_login: email, passwordHash, plain: plainPw })
	await db.addAudit(env.DB, "admin", "update", String(tid ?? id), name).catch(() => {})
	await backup.createBackup(env, "change", { label: "buyer-update" }).catch(() => {})
	return json({ ok: true })
}

async function apiBuyerDetail(req: Request, env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const body = (await req.json().catch(() => ({}))) as any
	const tid = parseInt(body.telegram_id, 10)
	const b = await db.getBuyerByTelegram(env.DB, tid)
	if (!b) return json({ error: "not_found" }, 404)
	const imap = await db.getImapForBuyer(env.DB, b.id)
	const domains = await db.listDomainsForBuyer(env.DB, b.id)
	const otpSuccess = await db.countMemberSuccess(env.DB, b.id)
	return json({
		ok: true,
		buyer: {
			name: b.name,
			telegram_id: b.telegram_id,
			email: b.email_login,
			status: b.status,
			active: db.isBuyerActive(b),
			expired_at: b.expired_at,
			created_at: b.created_at,
			otpSuccess,
		},
		imap: imap ? { host: imap.host, port: imap.port, username: imap.username, security: imap.security } : null,
		domains: domains.map((d) => d.domain),
	})
}

async function apiListWhitelist(req: Request, env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const body = (await req.json().catch(() => ({}))) as any
	const b = await db.getBuyerById(env.DB, parseInt(body.id, 10))
	if (!b) return json({ error: "not_found" }, 404)
	const wl = await db.listWhitelist(env.DB, b.id)
	// Resolve @username dari ID supaya entri ber-ID ditampilkan sebagai @username.
	const unames = await resolveUsernames(env, wl.map((w) => w.telegram_id))
	const enriched = wl.map((w) => ({
		...w,
		username: w.username || (w.telegram_id != null ? unames[w.telegram_id] || null : null),
	}))
	return json({ ok: true, whitelist: enriched })
}

async function apiAddWhitelist(req: Request, env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const body = (await req.json().catch(() => ({}))) as any
	const b = await db.getBuyerById(env.DB, parseInt(body.id, 10))
	if (!b) return json({ error: "not_found" }, 404)
	const parts = String(body.value || "")
		.split(/[\s,]+/)
		.map((x) => x.trim())
		.filter(Boolean)
	if (!parts.length) return json({ error: "missing" }, 400)
	const added: string[] = []
	const bad: string[] = []
	for (const p of parts) {
		const r = await db.addWhitelist(env.DB, b.id, p)
		if (r.ok) added.push(p)
		else bad.push(p)
	}
	await backup.createBackup(env, "change", { label: "whitelist-update" }).catch(() => {})
	return json({ ok: true, added, conflict: bad })
}

async function apiRemoveWhitelist(req: Request, env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const body = (await req.json().catch(() => ({}))) as any
	const b = await db.getBuyerById(env.DB, parseInt(body.id, 10))
	if (!b) return json({ error: "not_found" }, 404)
	const wid = parseInt(body.wid, 10)
	if (Number.isNaN(wid)) return json({ error: "bad_input" }, 400)
	await db.removeWhitelist(env.DB, b.id, wid)
	await backup.createBackup(env, "change", { label: "whitelist-update" }).catch(() => {})
	return json({ ok: true })
}

async function apiReactivateBuyer(req: Request, env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const body = (await req.json().catch(() => ({}))) as any
	const tid = parseInt(body.telegram_id, 10)
	const days = parseInt(body.days, 10)
	if (Number.isNaN(tid) || Number.isNaN(days) || days <= 0) return json({ error: "bad_input" }, 400)
	const b = await db.grantBuyer(env.DB, { telegram_id: tid, days })
	await db.addAudit(env.DB, "admin", "reactivate", String(tid), days + " hari").catch(() => {})
	if (env.BOT_TOKEN && b.telegram_id) await notifyNewBuyer(env, b.telegram_id, b.expired_at).catch(() => {})
	return json({ ok: true, expired_at: b.expired_at })
}

async function apiListAudit(env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	return json({ audit: await db.listAudit(env.DB, 50) })
}

async function apiListBackups(env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	return json({ backups: await db.listBackups(env.DB) })
}

async function apiCreateBackup(env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const r = await backup.createBackup(env, "manual", { label: "manual-web" })
	return json({ ok: true, ...r })
}

async function apiRestore(req: Request, env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const body = (await req.json().catch(() => ({}))) as any
	const id = parseInt(body.id, 10)
	if (Number.isNaN(id)) return json({ error: "bad_input" }, 400)
	const row = await db.getBackup(env.DB, id)
	if (!row) return json({ error: "not_found" }, 404)
	try {
		const snap = await backup.decodeBackup(env, row)
		const n = await backup.importData(env, snap)
		return json({ ok: true, rows: n })
	} catch (e: any) {
		return json({ error: "restore_failed", detail: String(e?.message || e) }, 500)
	}
}

async function apiGetBackupSettings(env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const enabledRaw = await db.getSetting(env.DB, "backup_enabled")
	return json({
		hour: parseInt((await db.getSetting(env.DB, "backup_hour")) || "3", 10),
		changeEnabled: (await db.getSetting(env.DB, "backup_change_enabled")) === "1",
		changeActiveOnly: (await db.getSetting(env.DB, "backup_change_active_only")) === "1",
		tgEnabled: (await db.getSetting(env.DB, "backup_tg_enabled")) === "1",
		tgChatId: (await db.getSetting(env.DB, "backup_tg_chat_id")) || "",
		// Default auto backup ON bila belum pernah diset (pertahankan perilaku lama).
		enabled: enabledRaw === null ? true : enabledRaw === "1",
		intervalDays: Math.max(1, parseInt((await db.getSetting(env.DB, "backup_interval_days")) || "1", 10)),
		scope: await backup.getScope(env.DB),
		lastStatus: (await db.getSetting(env.DB, "backup_last_status")) || "",
		lastAt: (await db.getSetting(env.DB, "backup_last_at")) || "",
	})
}

async function apiSetBackupSettings(req: Request, env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const body = (await req.json().catch(() => ({}))) as any
	if (body.hour !== undefined)
		await db.setSetting(env.DB, "backup_hour", String(parseInt(body.hour, 10) || 0))
	if (body.changeEnabled !== undefined)
		await db.setSetting(env.DB, "backup_change_enabled", body.changeEnabled ? "1" : "0")
	if (body.changeActiveOnly !== undefined)
		await db.setSetting(env.DB, "backup_change_active_only", body.changeActiveOnly ? "1" : "0")
	if (body.tgEnabled !== undefined)
		await db.setSetting(env.DB, "backup_tg_enabled", body.tgEnabled ? "1" : "0")
	if (body.tgChatId !== undefined)
		await db.setSetting(env.DB, "backup_tg_chat_id", String(body.tgChatId).trim())
	if (body.enabled !== undefined)
		await db.setSetting(env.DB, "backup_enabled", body.enabled ? "1" : "0")
	if (body.intervalDays !== undefined)
		await db.setSetting(env.DB, "backup_interval_days", String(Math.max(1, parseInt(body.intervalDays, 10) || 1)))
	if (body.scope !== undefined)
		await db.setSetting(env.DB, "backup_scope", backup.normalizeScope(body.scope).join(","))
	return json({ ok: true })
}

async function apiTestBackup(env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const r = await backup.sendTestBackup(env)
	return json(r, r.ok ? 200 : 400)
}

async function apiDbStats(env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const stats = await backup.dbStats(env.DB)
	const backups = await db.listBackups(env.DB)
	const latest = backups[0]
	return json({
		name: "database.db",
		engine: "Cloudflare D1 (SQLite)",
		rows: stats.rows,
		bytes: stats.bytes,
		tables: stats.tables,
		lastBackupAt: latest ? latest.created_at : "",
	})
}

// Rekap untuk dashboard admin: jumlah user, member, dan email/kode yang diproses.
async function apiStats(env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	return json(await db.getStats(env.DB))
}

async function apiRestoreFile(req: Request, env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const body = (await req.json().catch(() => ({}))) as any
	const content = typeof body.json === "string" ? body.json : ""
	if (!content.trim()) return json({ error: "bad_input" }, 400)
	if (content.length > 100 * 1024 * 1024) return json({ error: "too_large" }, 413)
	try {
		const n = await backup.restoreFromJson(env, content)
		return json({ ok: true, rows: n })
	} catch (e: any) {
		return json({ error: "restore_failed", detail: String(e?.message || e) }, 500)
	}
}

async function apiDownloadBackup(env: Env, s: db.Session, url: URL): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const id = parseInt(url.searchParams.get("id") || "", 10)
	if (Number.isNaN(id)) return json({ error: "bad_input" }, 400)
	const row = await db.getBackup(env.DB, id)
	if (!row) return json({ error: "not_found" }, 404)
	const snap = await backup.decodeBackup(env, row)
	const out = JSON.stringify(snap, null, 2)
	return new Response(out, {
		status: 200,
		headers: {
			"content-type": "application/json",
			"content-disposition": `attachment; filename="backup-${id}.json"`,
		},
	})
}

async function apiGetBrand(env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	return json({
		brand: (await db.getSetting(env.DB, "brand_name")) || "",
		welcome: (await db.getSetting(env.DB, "welcome_text")) || "",
		domain: (await db.getSetting(env.DB, "web_login_domain")) || "parciv.net",
	})
}

async function apiSetBrand(req: Request, env: Env, s: db.Session): Promise<Response> {
	if (!requireAdmin(s)) return json({ error: "admin_only" }, 403)
	const body = (await req.json().catch(() => ({}))) as any
	if (body.brand !== undefined)
		await db.setSetting(env.DB, "brand_name", String(body.brand).replace(/[<>]/g, "").trim())
	if (body.welcome !== undefined)
		await db.setSetting(env.DB, "welcome_text", String(body.welcome).trim())
	if (body.domain !== undefined) {
		const dom = String(body.domain).toLowerCase().replace(/[^a-z0-9.-]+/g, "").replace(/^[.-]+|[.-]+$/g, "")
		await db.setSetting(env.DB, "web_login_domain", dom || "parciv.net")
	}
	return json({ ok: true })
}
