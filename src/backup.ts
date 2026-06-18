// Backup/restore database (snapshot JSON, enkripsi AES-GCM opsional via BACKUP_KEY).
import type { Env } from "./env"
import * as db from "./db"
import { Telegram } from "./telegram"

// ---------- Scope backup ----------
// Kategori scope -> tabel/keys yang ikut dibackup. Admin bisa memilih sebagian.
export type ScopeKey =
	| "buyers"
	| "users"
	| "imap"
	| "domains"
	| "branding"
	| "backupset"
	| "logs"

export const SCOPE_ALL: ScopeKey[] = [
	"buyers",
	"users",
	"imap",
	"domains",
	"branding",
	"backupset",
	"logs",
]

// Kategori -> tabel penuh (settings ditangani terpisah via key subset).
const SCOPE_TABLES: Record<ScopeKey, string[]> = {
	buyers: ["buyers"],
	users: ["admins", "admin_accounts"],
	imap: ["imap_servers"],
	domains: ["domains"],
	branding: [],
	backupset: [],
	logs: ["audit_log", "search_log"],
}

// Urutan insert saat restore (relasi: buyers dulu sebelum imap/domains).
const TABLE_ORDER = [
	"admins",
	"admin_accounts",
	"buyers",
	"imap_servers",
	"domains",
	"search_log",
	"audit_log",
]

// settings key milik tiap grup.
const BRANDING_KEYS = ["brand_name", "welcome_text", "web_login_domain"]
const BACKUP_KEYS = [
	"backup_hour",
	"backup_change_enabled",
	"backup_change_active_only",
	"backup_tg_enabled",
	"backup_tg_chat_id",
	"backup_scope",
	"backup_enabled",
	"backup_interval_days",
	"backup_last_status",
	"backup_last_at",
	"backup_last_scheduled",
	"backup_last_scheduled_date",
	"reminder_hour",
]

function tableOwner(table: string): ScopeKey | undefined {
	return (Object.keys(SCOPE_TABLES) as ScopeKey[]).find((k) =>
		SCOPE_TABLES[k].includes(table),
	)
}

export function normalizeScope(arr: unknown): ScopeKey[] {
	if (!Array.isArray(arr)) return SCOPE_ALL.slice()
	const out = arr.filter((x): x is ScopeKey =>
		(SCOPE_ALL as string[]).includes(x as string),
	)
	return out.length ? out : SCOPE_ALL.slice()
}

export async function getScope(DB: D1Database): Promise<ScopeKey[]> {
	const raw = await db.getSetting(DB, "backup_scope")
	if (!raw) return SCOPE_ALL.slice()
	const arr = raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean)
	return normalizeScope(arr)
}

async function keyFrom(secret: string): Promise<CryptoKey> {
	const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret))
	return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
		"encrypt",
		"decrypt",
	])
}

function b64(bytes: Uint8Array): string {
	let s = ""
	for (const b of bytes) s += String.fromCharCode(b)
	return btoa(s)
}
function ub64(str: string): Uint8Array {
	const bin = atob(str)
	const out = new Uint8Array(bin.length)
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
	return out
}

async function encrypt(plain: string, secret: string): Promise<string> {
	const key = await keyFrom(secret)
	const iv = crypto.getRandomValues(new Uint8Array(12))
	const ct = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv: iv as BufferSource },
		key,
		new TextEncoder().encode(plain) as BufferSource,
	)
	return b64(iv) + ":" + b64(new Uint8Array(ct))
}

async function decrypt(payload: string, secret: string): Promise<string> {
	const [ivB64, ctB64] = payload.split(":")
	const key = await keyFrom(secret)
	const pt = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: ub64(ivB64) as BufferSource },
		key,
		ub64(ctB64) as BufferSource,
	)
	return new TextDecoder().decode(pt)
}

export type Snapshot = {
	version: number
	created_at: string
	scope?: ScopeKey[]
	tables: Record<string, Record<string, unknown>[]>
}

export async function exportData(
	DB: D1Database,
	opts: { activeOnly?: boolean; scope?: ScopeKey[] } = {},
): Promise<{ snapshot: Snapshot; rows: number }> {
	const scope = opts.scope && opts.scope.length ? opts.scope : SCOPE_ALL.slice()
	const tables: Record<string, Record<string, unknown>[]> = {}
	let total = 0
	for (const t of TABLE_ORDER) {
		const owner = tableOwner(t)
		if (!owner || !scope.includes(owner)) continue
		let sql = `SELECT * FROM ${t}`
		if (opts.activeOnly && t === "buyers") sql += " WHERE status = 'active'"
		const r = await DB.prepare(sql).all<Record<string, unknown>>()
		tables[t] = r.results || []
		total += tables[t].length
	}
	// settings: hanya key subset sesuai grup yang dipilih.
	const keys: string[] = []
	if (scope.includes("branding")) keys.push(...BRANDING_KEYS)
	if (scope.includes("backupset")) keys.push(...BACKUP_KEYS)
	if (keys.length) {
		const placeholders = keys.map(() => "?").join(", ")
		const r = await DB.prepare(
			`SELECT * FROM settings WHERE key IN (${placeholders})`,
		)
			.bind(...keys)
			.all<Record<string, unknown>>()
		tables["settings"] = r.results || []
		total += tables["settings"].length
	}
	return {
		snapshot: { version: 3, created_at: db.now(), scope, tables },
		rows: total,
	}
}

export async function createBackup(
	env: Env,
	kind: "scheduled" | "change" | "manual",
	opts: { label?: string; activeOnly?: boolean; scope?: ScopeKey[] } = {},
): Promise<{ id: number; rows: number; encrypted: boolean }> {
	try {
		const scope = opts.scope || (await getScope(env.DB))
		const { snapshot, rows } = await exportData(env.DB, {
			activeOnly: opts.activeOnly,
			scope,
		})
		const json = JSON.stringify(snapshot)
		let data = json
		let encrypted = false
		if (env.BACKUP_KEY) {
			data = await encrypt(json, env.BACKUP_KEY)
			encrypted = true
		}
		const label = opts.label || `${kind}-${new Date().toISOString().slice(0, 16)}`
		const id = await db.insertBackup(env.DB, { label, kind, encrypted, data, rows })
		const retention = parseInt(env.BACKUP_RETENTION || "3", 10)
		await db.pruneBackups(env.DB, retention)
		// Kirim ke Telegram untuk backup manual/terjadwal (hindari spam saat "change").
		if (kind !== "change") await sendBackupToTelegram(env, id, label, json).catch(() => {})
		await db.setSetting(env.DB, "backup_last_status", "success").catch(() => {})
		await db.setSetting(env.DB, "backup_last_at", db.now()).catch(() => {})
		return { id, rows, encrypted }
	} catch (e) {
		await db.setSetting(env.DB, "backup_last_status", "failed").catch(() => {})
		throw e
	}
}

// Kirim snapshot JSON ke grup/channel Telegram bila admin mengaktifkannya.
async function sendBackupToTelegram(env: Env, id: number, label: string, jsonStr: string): Promise<void> {
	if (!env.BOT_TOKEN) return
	if ((await db.getSetting(env.DB, "backup_tg_enabled")) !== "1") return
	const chat = ((await db.getSetting(env.DB, "backup_tg_chat_id")) || "").trim()
	if (!chat) return
	const tg = new Telegram(env.BOT_TOKEN)
	const chatId: number | string = /^-?\d+$/.test(chat) ? parseInt(chat, 10) : chat
	await tg.sendDocument(chatId, `backup-${id}.json`, jsonStr, `\uD83D\uDCBE Backup #${id} \u00b7 ${label}`)
}

// Test backup: kirim snapshot ke Telegram TANPA menyimpan/menghapus data (tidak menyentuh tabel backups).
export async function sendTestBackup(
	env: Env,
): Promise<{ ok: boolean; rows?: number; error?: string }> {
	if (!env.BOT_TOKEN) return { ok: false, error: "no_bot_token" }
	if ((await db.getSetting(env.DB, "backup_tg_enabled")) !== "1")
		return { ok: false, error: "tg_disabled" }
	const chat = ((await db.getSetting(env.DB, "backup_tg_chat_id")) || "").trim()
	if (!chat) return { ok: false, error: "no_chat_id" }
	const scope = await getScope(env.DB)
	const { snapshot, rows } = await exportData(env.DB, { scope })
	const json = JSON.stringify(snapshot)
	const tg = new Telegram(env.BOT_TOKEN)
	const chatId: number | string = /^-?\d+$/.test(chat) ? parseInt(chat, 10) : chat
	const stamp = new Date().toISOString().slice(0, 16)
	await tg.sendDocument(
		chatId,
		`test-backup-${stamp}.json`,
		json,
		`\uD83E\uDDEA Test Backup \u00b7 FLIXVAULT \u00b7 ${rows} baris`,
	)
	return { ok: true, rows }
}

// Statistik database: jumlah baris + perkiraan ukuran (byte JSON snapshot penuh).
export async function dbStats(
	DB: D1Database,
): Promise<{ rows: number; bytes: number; tables: number }> {
	const { snapshot, rows } = await exportData(DB, { scope: SCOPE_ALL.slice() })
	const bytes = new TextEncoder().encode(JSON.stringify(snapshot)).length
	return { rows, bytes, tables: Object.keys(snapshot.tables).length }
}

export async function decodeBackup(
	env: Env,
	row: { data: string; encrypted: number },
): Promise<Snapshot> {
	const raw = row.encrypted
		? await decrypt(row.data, env.BACKUP_KEY || "")
		: row.data
	return JSON.parse(raw) as Snapshot
}

export async function importData(env: Env, snapshot: Snapshot): Promise<number> {
	let total = 0
	const order = [...TABLE_ORDER, "settings"]
	for (const t of order) {
		const rows = snapshot.tables[t]
		if (!rows) continue
		if (t === "settings") {
			// settings di-upsert agar key di luar scope tidak hilang.
			for (const row of rows) {
				const key = (row as any).key
				const value = (row as any).value
				if (key === undefined) continue
				await env.DB.prepare(
					"INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
				)
					.bind(key, value)
					.run()
				total++
			}
			continue
		}
		await env.DB.prepare(`DELETE FROM ${t}`).run()
		for (const row of rows) {
			const cols = Object.keys(row)
			if (cols.length === 0) continue
			const placeholders = cols.map(() => "?").join(", ")
			const values = cols.map((c) => row[c] as never)
			await env.DB.prepare(
				`INSERT INTO ${t} (${cols.join(", ")}) VALUES (${placeholders})`,
			)
				.bind(...values)
				.run()
			total++
		}
	}
	return total
}

// Restore dari snapshot JSON mentah (string). Membuat snapshot pengaman dulu.
export async function restoreFromJson(env: Env, json: string): Promise<number> {
	await createBackup(env, "manual", { label: "auto-sebelum-restore", scope: SCOPE_ALL.slice() })
	const snapshot = JSON.parse(json) as Snapshot
	if (!snapshot.tables) throw new Error("Format backup tidak valid")
	return importData(env, snapshot)
}
