// Lapisan akses D1: semua query terpusat di sini.
import type { ImapSecurity } from "./imap"

export function now(): string {
	return new Date().toISOString()
}

export type Buyer = {
	id: number
	telegram_id: number | null
	name: string
	email_login: string | null
	password_hash: string | null
	password_plain: string | null
	expired_at: string | null
	status: string
	created_by: number | null
	created_at: string
}

export type ImapServer = {
	id: number
	buyer_id: number
	host: string
	port: number
	username: string
	password: string
	security: ImapSecurity
	updated_at: string
}

export type DomainRow = {
	domain: string
	buyer_id: number
	imap_server_id: number
	created_at: string
}

// ---------- Admin ----------
export async function countAdmins(db: D1Database): Promise<number> {
	const r = await db.prepare("SELECT COUNT(*) AS c FROM admins").first<{ c: number }>()
	return r?.c ?? 0
}

export async function isAdmin(db: D1Database, tid: number): Promise<boolean> {
	const r = await db
		.prepare("SELECT telegram_id FROM admins WHERE telegram_id = ?")
		.bind(tid)
		.first()
	return !!r
}

export async function addAdmin(db: D1Database, tid: number): Promise<void> {
	await db
		.prepare("INSERT OR IGNORE INTO admins (telegram_id, added_at) VALUES (?, ?)")
		.bind(tid, now())
		.run()
}

// ---------- State wizard ----------
export type BotState = { step: string; draft: Record<string, unknown> }

export async function getState(db: D1Database, tid: number): Promise<BotState | null> {
	const r = await db
		.prepare("SELECT step, draft FROM bot_state WHERE telegram_id = ?")
		.bind(tid)
		.first<{ step: string; draft: string }>()
	if (!r) return null
	return { step: r.step, draft: JSON.parse(r.draft || "{}") }
}

export async function setState(
	db: D1Database,
	tid: number,
	step: string,
	draft: Record<string, unknown>,
): Promise<void> {
	await db
		.prepare(
			"INSERT INTO bot_state (telegram_id, step, draft, updated_at) VALUES (?, ?, ?, ?) " +
				"ON CONFLICT(telegram_id) DO UPDATE SET step=excluded.step, draft=excluded.draft, updated_at=excluded.updated_at",
		)
		.bind(tid, step, JSON.stringify(draft), now())
		.run()
}

export async function clearState(db: D1Database, tid: number): Promise<void> {
	await db.prepare("DELETE FROM bot_state WHERE telegram_id = ?").bind(tid).run()
}

// ---------- Buyer ----------
export async function getBuyerByTelegram(
	db: D1Database,
	tid: number,
): Promise<Buyer | null> {
	return db
		.prepare("SELECT * FROM buyers WHERE telegram_id = ?")
		.bind(tid)
		.first<Buyer>()
}

export async function getBuyerById(db: D1Database, id: number): Promise<Buyer | null> {
	return db.prepare("SELECT * FROM buyers WHERE id = ?").bind(id).first<Buyer>()
}

export async function getBuyerByEmail(
	db: D1Database,
	email: string,
): Promise<Buyer | null> {
	return db
		.prepare("SELECT * FROM buyers WHERE email_login = ?")
		.bind(email.toLowerCase())
		.first<Buyer>()
}

export async function listBuyers(db: D1Database): Promise<Buyer[]> {
	const r = await db
		.prepare("SELECT * FROM buyers ORDER BY created_at DESC")
		.all<Buyer>()
	return r.results || []
}

export function isBuyerActive(b: Buyer | null): boolean {
	if (!b) return false
	if (b.status !== "active") return false
	if (!b.expired_at) return false
	return Date.parse(b.expired_at) > Date.now()
}

// Buat buyer baru ATAU perpanjang langganan (grant).
export async function grantBuyer(
	db: D1Database,
	opts: { telegram_id: number; days: number; name?: string; created_by?: number },
): Promise<Buyer> {
	const existing = await getBuyerByTelegram(db, opts.telegram_id)
	const base =
		existing && existing.expired_at && Date.parse(existing.expired_at) > Date.now()
			? Date.parse(existing.expired_at)
			: Date.now()
	const newExpiry = new Date(base + opts.days * 86400000).toISOString()
	if (existing) {
		await db
			.prepare(
				"UPDATE buyers SET expired_at = ?, status = 'active'" +
					(opts.name ? ", name = ?" : "") +
					" WHERE id = ?",
			)
			.bind(...(opts.name ? [newExpiry, opts.name, existing.id] : [newExpiry, existing.id]))
			.run()
		return (await getBuyerById(db, existing.id))!
	}
	const res = await db
		.prepare(
			"INSERT INTO buyers (telegram_id, name, expired_at, status, created_by, created_at) " +
				"VALUES (?, ?, ?, 'active', ?, ?)",
		)
		.bind(
			opts.telegram_id,
			opts.name || `Member ${opts.telegram_id}`,
			newExpiry,
			opts.created_by ?? null,
			now(),
		)
		.run()
	const id = res.meta.last_row_id as number
	return (await getBuyerById(db, id))!
}

export async function createBuyerManual(
	db: D1Database,
	opts: { telegram_id: number; name: string; days: number; created_by?: number },
): Promise<Buyer> {
	return grantBuyer(db, opts)
}

export async function revokeBuyer(db: D1Database, buyerId: number): Promise<void> {
	await db
		.prepare("UPDATE buyers SET status = 'suspended' WHERE id = ?")
		.bind(buyerId)
		.run()
}

export async function deleteBuyer(db: D1Database, buyerId: number): Promise<void> {
	await db.prepare("DELETE FROM domains WHERE buyer_id = ?").bind(buyerId).run()
	await db.prepare("DELETE FROM imap_servers WHERE buyer_id = ?").bind(buyerId).run()
	await db.prepare("DELETE FROM web_sessions WHERE buyer_id = ?").bind(buyerId).run()
	await db.prepare("DELETE FROM buyers WHERE id = ?").bind(buyerId).run()
}

export type AuditRow = { id: number; actor: string; action: string; target: string | null; detail: string | null; created_at: string }

async function ensureAuditTable(db: D1Database): Promise<void> {
	await db.prepare("CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT, detail TEXT, created_at TEXT NOT NULL)").run()
}

export async function addAudit(db: D1Database, actor: string, action: string, target?: string | null, detail?: string | null): Promise<void> {
	await ensureAuditTable(db)
	await db.prepare("INSERT INTO audit_log (actor, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?)").bind(actor, action, target ?? null, detail ?? null, now()).run()
}

export async function listAudit(db: D1Database, limit = 50): Promise<AuditRow[]> {
	await ensureAuditTable(db)
	const r = await db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?").bind(limit).all<AuditRow>()
	return r.results || []
}

export async function setBuyerLogin(
	db: D1Database,
	buyerId: number,
	email: string,
	passwordHash: string,
	plain?: string | null,
): Promise<void> {
	await db
		.prepare("UPDATE buyers SET email_login = ?, password_hash = ?, password_plain = ? WHERE id = ?")
		.bind(email.toLowerCase(), passwordHash, plain ?? null, buyerId)
		.run()
}

// Update field profil buyer (nama / telegram_id / email login / opsional password).
export async function updateBuyer(
	db: D1Database,
	id: number,
	fields: { name: string; telegram_id: number | null; email_login: string | null; passwordHash?: string | null; plain?: string | null },
): Promise<void> {
	const email = fields.email_login ? fields.email_login.toLowerCase() : null
	if (fields.passwordHash) {
		await db
			.prepare("UPDATE buyers SET name = ?, telegram_id = ?, email_login = ?, password_hash = ?, password_plain = ? WHERE id = ?")
			.bind(fields.name, fields.telegram_id, email, fields.passwordHash, fields.plain ?? null, id)
			.run()
	} else {
		await db
			.prepare("UPDATE buyers SET name = ?, telegram_id = ?, email_login = ? WHERE id = ?")
			.bind(fields.name, fields.telegram_id, email, id)
			.run()
	}
}

// ---------- Admin web account ----------
export async function getAdminAccountByEmail(db: D1Database, email: string) {
	return db
		.prepare("SELECT * FROM admin_accounts WHERE email = ?")
		.bind(email.toLowerCase())
		.first<{ id: number; email: string; password_hash: string }>()
}

export async function upsertAdminAccount(
	db: D1Database,
	email: string,
	passwordHash: string,
): Promise<void> {
	await db
		.prepare(
			"INSERT INTO admin_accounts (email, password_hash, created_at) VALUES (?, ?, ?) " +
				"ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash",
		)
		.bind(email.toLowerCase(), passwordHash, now())
		.run()
}

// ---------- IMAP ----------
export async function getImapForBuyer(
	db: D1Database,
	buyerId: number,
): Promise<ImapServer | null> {
	return db
		.prepare("SELECT * FROM imap_servers WHERE buyer_id = ?")
		.bind(buyerId)
		.first<ImapServer>()
}

export async function getImapById(db: D1Database, id: number): Promise<ImapServer | null> {
	return db.prepare("SELECT * FROM imap_servers WHERE id = ?").bind(id).first<ImapServer>()
}

export async function setImapForBuyer(
	db: D1Database,
	buyerId: number,
	cfg: { host: string; port: number; username: string; password: string; security: ImapSecurity },
): Promise<number> {
	const existing = await getImapForBuyer(db, buyerId)
	if (existing) {
		await db
			.prepare(
				"UPDATE imap_servers SET host=?, port=?, username=?, password=?, security=?, updated_at=? WHERE buyer_id=?",
			)
			.bind(cfg.host, cfg.port, cfg.username, cfg.password, cfg.security, now(), buyerId)
			.run()
		return existing.id
	}
	const res = await db
		.prepare(
			"INSERT INTO imap_servers (buyer_id, host, port, username, password, security, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		)
		.bind(buyerId, cfg.host, cfg.port, cfg.username, cfg.password, cfg.security, now())
		.run()
	return res.meta.last_row_id as number
}

// ---------- Domain ----------
export async function getDomainOwner(
	db: D1Database,
	domain: string,
): Promise<DomainRow | null> {
	return db
		.prepare("SELECT * FROM domains WHERE domain = ?")
		.bind(domain.toLowerCase())
		.first<DomainRow>()
}

export async function listDomainsForBuyer(
	db: D1Database,
	buyerId: number,
): Promise<DomainRow[]> {
	const r = await db
		.prepare("SELECT * FROM domains WHERE buyer_id = ? ORDER BY domain")
		.bind(buyerId)
		.all<DomainRow>()
	return r.results || []
}

// Memecah input jadi daftar domain bersih. Dukung pemisah koma, spasi, titik-koma,
// baris baru, dan pipe. Auto-deteksi: buang http(s)://, www., path/port/query, dan
// ambil bagian host dari email/URL. Duplikat dihilangkan.
export function parseDomains(input: string): string[] {
	const out: string[] = []
	const seen = new Set<string>()
	for (let tok of String(input || "").split(/[\s,;|]+/)) {
		tok = tok.trim().toLowerCase()
		if (!tok) continue
		tok = tok.replace(/^https?:\/\//, "")
		if (tok.includes("@")) tok = tok.split("@").pop() || ""
		tok = tok.replace(/^www\./, "")
		tok = tok.split("/")[0].split(":")[0].split("?")[0]
		tok = tok.replace(/^\.+|\.+$/g, "")
		if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(tok)) continue
		if (seen.has(tok)) continue
		seen.add(tok)
		out.push(tok)
	}
	return out
}

// Mengembalikan { ok } atau { ok:false, conflict } kalau domain sudah dimiliki buyer lain.
export async function addDomain(
	db: D1Database,
	domain: string,
	buyerId: number,
	imapId: number,
): Promise<{ ok: boolean; conflict?: number }> {
	const d = domain.toLowerCase().trim()
	const existing = await getDomainOwner(db, d)
	if (existing) {
		if (existing.buyer_id === buyerId) return { ok: true }
		return { ok: false, conflict: existing.buyer_id }
	}
	await db
		.prepare(
			"INSERT INTO domains (domain, buyer_id, imap_server_id, created_at) VALUES (?, ?, ?, ?)",
		)
		.bind(d, buyerId, imapId, now())
		.run()
	return { ok: true }
}

export async function removeDomain(
	db: D1Database,
	domain: string,
	buyerId: number,
): Promise<void> {
	await db
		.prepare("DELETE FROM domains WHERE domain = ? AND buyer_id = ?")
		.bind(domain.toLowerCase(), buyerId)
		.run()
}

// ---------- Rate limit & log ----------
export async function countRecentSearches(
	db: D1Database,
	tid: number,
	seconds: number,
): Promise<number> {
	const since = new Date(Date.now() - seconds * 1000).toISOString()
	const r = await db
		.prepare("SELECT COUNT(*) AS c FROM search_log WHERE telegram_id = ? AND created_at > ?")
		.bind(tid, since)
		.first<{ c: number }>()
	return r?.c ?? 0
}

export async function logSearch(
	db: D1Database,
	tid: number | null,
	email: string,
	category: string,
	result: string,
): Promise<void> {
	await db
		.prepare(
			"INSERT INTO search_log (telegram_id, email, category, result, created_at) VALUES (?, ?, ?, ?, ?)",
		)
		.bind(tid, email, category, result, now())
		.run()
}

// Jumlah OTP/kode sukses (result='found') per member, dipetakan via domain email.
export async function successCountByBuyer(
	db: D1Database,
): Promise<Record<number, number>> {
	const r = await db
		.prepare(
			"SELECT d.buyer_id AS bid, COUNT(*) AS c FROM search_log s JOIN domains d ON lower(substr(s.email, instr(s.email, '@') + 1)) = lower(d.domain) WHERE s.result = 'found' GROUP BY d.buyer_id",
		)
		.all<{ bid: number; c: number }>()
	const map: Record<number, number> = {}
	for (const row of r.results || []) map[row.bid] = row.c
	return map
}

// Jumlah OTP/kode sukses untuk satu member.
export async function countMemberSuccess(
	db: D1Database,
	buyerId: number,
): Promise<number> {
	const r = await db
		.prepare(
			"SELECT COUNT(*) AS c FROM search_log s JOIN domains d ON lower(substr(s.email, instr(s.email, '@') + 1)) = lower(d.domain) WHERE s.result = 'found' AND d.buyer_id = ?",
		)
		.bind(buyerId)
		.first<{ c: number }>()
	return r?.c ?? 0
}

// ---------- Settings ----------
export async function getSetting(db: D1Database, key: string): Promise<string | null> {
	const r = await db
		.prepare("SELECT value FROM settings WHERE key = ?")
		.bind(key)
		.first<{ value: string }>()
	return r?.value ?? null
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
	await db
		.prepare(
			"INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		)
		.bind(key, value)
		.run()
}

// ---------- Sessions ----------
export type Session = {
	token: string
	buyer_id: number | null
	is_admin: number
	expires_at: string
}

export async function createSession(
	db: D1Database,
	token: string,
	opts: { buyerId?: number; isAdmin: boolean; ttlHours: number },
): Promise<void> {
	const expires = new Date(Date.now() + opts.ttlHours * 3600000).toISOString()
	await db
		.prepare(
			"INSERT INTO web_sessions (token, buyer_id, is_admin, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
		)
		.bind(token, opts.buyerId ?? null, opts.isAdmin ? 1 : 0, now(), expires)
		.run()
}

export async function getSession(db: D1Database, token: string): Promise<Session | null> {
	const r = await db
		.prepare("SELECT * FROM web_sessions WHERE token = ?")
		.bind(token)
		.first<Session>()
	if (!r) return null
	if (Date.parse(r.expires_at) < Date.now()) {
		await deleteSession(db, token)
		return null
	}
	return r
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
	await db.prepare("DELETE FROM web_sessions WHERE token = ?").bind(token).run()
}

// ---------- Backups ----------
export async function insertBackup(
	db: D1Database,
	row: { label: string; kind: string; encrypted: boolean; data: string; rows: number },
): Promise<number> {
	const res = await db
		.prepare(
			"INSERT INTO backups (label, kind, encrypted, data, rows, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		)
		.bind(row.label, row.kind, row.encrypted ? 1 : 0, row.data, row.rows, now())
		.run()
	return res.meta.last_row_id as number
}

export type BackupRow = {
	id: number
	label: string
	kind: string
	encrypted: number
	data: string
	rows: number
	created_at: string
}

export async function listBackups(db: D1Database): Promise<Omit<BackupRow, "data">[]> {
	const r = await db
		.prepare("SELECT id, label, kind, encrypted, rows, created_at FROM backups ORDER BY id DESC")
		.all<Omit<BackupRow, "data">>()
	return r.results || []
}

export async function getBackup(db: D1Database, id: number): Promise<BackupRow | null> {
	return db.prepare("SELECT * FROM backups WHERE id = ?").bind(id).first<BackupRow>()
}

export async function pruneBackups(db: D1Database, retention: number): Promise<void> {
	await db
		.prepare(
			"DELETE FROM backups WHERE id NOT IN (SELECT id FROM backups ORDER BY id DESC LIMIT ?)",
		)
		.bind(retention)
		.run()
}

// ---------- Bot users (pelacak semua pemakai bot) ----------
let botUsersReady = false
async function ensureBotUsersTable(db: D1Database): Promise<void> {
	if (botUsersReady) return
	await db
		.prepare(
			"CREATE TABLE IF NOT EXISTS bot_users (telegram_id INTEGER PRIMARY KEY, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, username TEXT)",
		)
		.run()
	// Migrasi: tambah kolom username untuk DB yang sudah membuat bot_users versi lama.
	try {
		await db.prepare("ALTER TABLE bot_users ADD COLUMN username TEXT").run()
	} catch {
		// kolom sudah ada — abaikan
	}
	botUsersReady = true
}

export async function trackUser(db: D1Database, tid: number, username?: string | null): Promise<void> {
	if (!tid) return
	await ensureBotUsersTable(db)
	await db
		.prepare(
			"INSERT INTO bot_users (telegram_id, first_seen, last_seen, username) VALUES (?, ?, ?, ?) " +
				"ON CONFLICT(telegram_id) DO UPDATE SET last_seen = excluded.last_seen, " +
				"username = COALESCE(excluded.username, bot_users.username)",
		)
		.bind(tid, now(), now(), username ?? null)
		.run()
}

// Ambil map telegram_id -> @username untuk sekumpulan id (List Member & dashboard).
export async function getUsernames(db: D1Database, ids: Array<number | null | undefined>): Promise<Record<number, string>> {
	const out: Record<number, string> = {}
	const clean = ids.filter((x): x is number => !!x)
	if (clean.length === 0) return out
	await ensureBotUsersTable(db)
	const placeholders = clean.map(() => "?").join(",")
	const r = await db
		.prepare("SELECT telegram_id, username FROM bot_users WHERE telegram_id IN (" + placeholders + ")")
		.bind(...clean)
		.all<{ telegram_id: number; username: string | null }>()
	for (const row of r.results || []) {
		if (row.username) out[row.telegram_id] = row.username
	}
	return out
}

export async function countBotUsers(db: D1Database): Promise<number> {
	await ensureBotUsersTable(db)
	const r = await db.prepare("SELECT COUNT(*) AS c FROM bot_users").first<{ c: number }>()
	return r?.c ?? 0
}

// ---------- Whitelist user per member ----------
export type WhitelistEntry = {
	id: number
	buyer_id: number
	telegram_id: number | null
	username: string | null
	created_at: string
}

let whitelistReady = false
async function ensureWhitelistTable(db: D1Database): Promise<void> {
	if (whitelistReady) return
	await db
		.prepare(
			"CREATE TABLE IF NOT EXISTS member_whitelist (id INTEGER PRIMARY KEY AUTOINCREMENT, buyer_id INTEGER NOT NULL, telegram_id INTEGER, username TEXT, created_at TEXT NOT NULL)",
		)
		.run()
	whitelistReady = true
}

export async function listWhitelist(db: D1Database, buyerId: number): Promise<WhitelistEntry[]> {
	await ensureWhitelistTable(db)
	const r = await db
		.prepare("SELECT * FROM member_whitelist WHERE buyer_id = ? ORDER BY created_at DESC")
		.bind(buyerId)
		.all<WhitelistEntry>()
	return r.results || []
}

export async function countWhitelist(db: D1Database, buyerId: number): Promise<number> {
	await ensureWhitelistTable(db)
	const r = await db
		.prepare("SELECT COUNT(*) AS c FROM member_whitelist WHERE buyer_id = ?")
		.bind(buyerId)
		.first<{ c: number }>()
	return r?.c ?? 0
}

// Tambah entri whitelist. raw bisa "@username", "username", atau ID Telegram numerik.
export async function addWhitelist(
	db: D1Database,
	buyerId: number,
	raw: string,
): Promise<{ ok: boolean; reason?: string }> {
	await ensureWhitelistTable(db)
	const v = raw.trim().replace(/^@/, "")
	if (!v) return { ok: false, reason: "empty" }
	let tid: number | null = null
	let uname: string | null = null
	if (/^\d+$/.test(v)) tid = parseInt(v, 10)
	else uname = v.toLowerCase()
	const dup =
		tid != null
			? await db
					.prepare("SELECT id FROM member_whitelist WHERE buyer_id = ? AND telegram_id = ?")
					.bind(buyerId, tid)
					.first<{ id: number }>()
			: await db
					.prepare("SELECT id FROM member_whitelist WHERE buyer_id = ? AND lower(username) = ?")
					.bind(buyerId, uname)
					.first<{ id: number }>()
	if (dup) return { ok: false, reason: "exists" }
	await db
		.prepare("INSERT INTO member_whitelist (buyer_id, telegram_id, username, created_at) VALUES (?, ?, ?, ?)")
		.bind(buyerId, tid, uname, now())
		.run()
	return { ok: true }
}

export async function removeWhitelist(db: D1Database, buyerId: number, id: number): Promise<void> {
	await ensureWhitelistTable(db)
	await db
		.prepare("DELETE FROM member_whitelist WHERE buyer_id = ? AND id = ?")
		.bind(buyerId, id)
		.run()
}

// Apakah requester boleh akses domain milik buyer ini?
// Whitelist kosong -> true (opt-in: terbuka). Jika ada -> cocokkan tid atau username.
export async function isWhitelisted(
	db: D1Database,
	buyerId: number,
	tid: number,
	username?: string | null,
): Promise<boolean> {
	await ensureWhitelistTable(db)
	if ((await countWhitelist(db, buyerId)) === 0) return true
	const byId = await db
		.prepare("SELECT id FROM member_whitelist WHERE buyer_id = ? AND telegram_id = ?")
		.bind(buyerId, tid)
		.first<{ id: number }>()
	if (byId) return true
	if (username) {
		const u = username.toLowerCase().replace(/^@/, "")
		const byName = await db
			.prepare("SELECT id FROM member_whitelist WHERE buyer_id = ? AND lower(username) = ?")
			.bind(buyerId, u)
			.first<{ id: number }>()
		if (byName) return true
	}
	return false
}

// ---------- Statistik (rekap untuk dashboard admin) ----------
export type StatsResult = {
	users: number
	members: number
	membersActive: number
	membersSuspended: number
	processed: number
	found: number
	notfound: number
	processedToday: number
	processedWeek: number
	processedMonth: number
}

export async function getStats(db: D1Database): Promise<StatsResult> {
	const users = await countBotUsers(db)
	const buyers = await listBuyers(db)
	let members = 0
	let membersActive = 0
	for (const b of buyers) {
		const adm = b.telegram_id ? await isAdmin(db, b.telegram_id) : false
		if (adm) continue
		members++
		if (isBuyerActive(b)) membersActive++
	}
	const membersSuspended = members - membersActive
	const one = async (sql: string, ...params: unknown[]): Promise<number> => {
		const r = await db.prepare(sql).bind(...params).first<{ c: number }>()
		return r?.c ?? 0
	}
	const processed = await one("SELECT COUNT(*) AS c FROM search_log")
	const found = await one("SELECT COUNT(*) AS c FROM search_log WHERE result = 'found'")
	const notfound = await one("SELECT COUNT(*) AS c FROM search_log WHERE result != 'found'")
	const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString()
	const processedToday = await one("SELECT COUNT(*) AS c FROM search_log WHERE created_at > ?", since(1))
	const processedWeek = await one("SELECT COUNT(*) AS c FROM search_log WHERE created_at > ?", since(7))
	const processedMonth = await one("SELECT COUNT(*) AS c FROM search_log WHERE created_at > ?", since(30))
	return { users, members, membersActive, membersSuspended, processed, found, notfound, processedToday, processedWeek, processedMonth }
}
