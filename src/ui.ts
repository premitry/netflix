// Template pesan bot - tema modern "FLIXVAULT".
import type { InlineButton } from "./telegram"
import { CATEGORIES, type CategoryKey } from "./netflix"

export let BRAND = "\u26A1 FLIXVAULT"
const LINE = "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501"

let WELCOME_OVERRIDE: string | null = null

// Diatur dari settings (db) agar nama & teks sambutan bisa diganti admin.
export function setBrand(name?: string | null): void {
	if (name && name.trim()) BRAND = name.trim()
}
export function setWelcome(text?: string | null): void {
	WELCOME_OVERRIDE = text && text.trim() ? text.trim() : null
}

export function frame(title: string, lines: string[]): string {
	return `<b>${title}</b>\n${LINE}\n${lines.join("\n")}`
}

function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export const ui = {
	welcome(): string {
		if (WELCOME_OVERRIDE) return frame(BRAND, WELCOME_OVERRIDE.split("\n"))
		return frame(BRAND, [
			"Selamat datang \uD83D\uDC4B",
			"",
			"Kirim <b>alamat email</b> yang ingin dicek,",
			"lalu pilih kategori yang muncul.",
			"",
			"Ketik /myid untuk melihat ID Telegram-mu.",
		])
	},

	invalidEmail(): string {
		return frame(BRAND, ["\u26A0\uFE0F Format email tidak valid.", "Contoh: <code>nama@domain.com</code>"])
	},

	domainNotFound(domain: string): string {
		return frame(BRAND, [
			`\u274C Domain <code>${esc(domain)}</code> belum terdaftar.`,
			"Hubungi penjual untuk memastikan domain aktif.",
		])
	},

	chooseCategory(email: string, isPrivileged: boolean): string {
		const lines = [
			`Email: <code>${esc(email)}</code>`,
			"",
			"Pilih kategori yang ingin dicari:",
		]
		if (!isPrivileged) {
			lines.push("", "\uD83D\uDD12 <i>Reset Password & Reset Email khusus member.</i>")
		}
		return frame(BRAND, lines)
	},

	searching(label: string): string {
		return frame(BRAND, [`\u23F3 Mencari <b>${label}</b>...`, "Mohon tunggu sebentar."])
	},

	found(label: string, kind: "code" | "link", value: string, date?: string, backupLink?: string): string {
		const lines = [`\u2705 <b>${label}</b> ditemukan:`, ""]
		if (kind === "code") lines.push(`\uD83D\uDD22 Kode: <code>${esc(value)}</code>`)
		else lines.push(`\uD83D\uDD17 <a href="${esc(value)}">Klik di sini</a>`)
		if (backupLink) lines.push("", `\uD83D\uDD17 <a href="${esc(backupLink)}">Buka manual bila kode salah/kedaluwarsa</a>`)
		if (date) lines.push("", `\uD83D\uDD52 ${esc(date)}`)
		return frame(BRAND, lines)
	},

	notFound(label: string): string {
		return frame(BRAND, [
			`\uD83D\uDE15 <b>${label}</b> belum ditemukan.`,
			"Coba lagi beberapa saat setelah email masuk.",
		])
	},

	rateLimited(): string {
		return frame(BRAND, ["\u23F3 Terlalu banyak permintaan.", "Tunggu sebentar lalu coba lagi."])
	},

	denied(): string {
		return frame(BRAND, ["\uD83D\uDD12 Fitur ini khusus <b>member</b> aktif."])
	},

	searchError(): string {
		return frame(BRAND, ["\u26A0\uFE0F Gagal terhubung ke server email.", "Periksa pengaturan IMAP."])
	},

	notConfigured(): string {
		return frame(BRAND, ["\u2699\uFE0F IMAP belum diatur untuk domain ini."])
	},

	myId(id: number): string {
		return frame(BRAND, [`\uD83C\uDD94 ID Telegram-mu: <code>${id}</code>`])
	},
}

// ---------- Keyboards ----------
export function categoryKeyboard(isPrivileged: boolean): InlineButton[][] {
	const rows: InlineButton[][] = [
		[btn("signin"), btn("household")],
		[btn("tvlink")],
	]
	if (isPrivileged) rows.push([btn("resetpw"), btn("resetemail")])
	return rows
}

function btn(key: CategoryKey): InlineButton {
	return { text: CATEGORIES[key].label, callback_data: `cat:${key}` }
}

export function resultKeyboard(key: CategoryKey): InlineButton[][] {
	return [
		[{ text: "\uD83D\uDD04 Refresh (cek lagi)", callback_data: `cat:${key}` }],
		[
			{ text: "\uD83D\uDD01 Kategori lain", callback_data: "act:again" },
			{ text: "\uD83D\uDCE7 Email lain", callback_data: "act:reset" },
		],
	]
}

export function foundKeyboard(): InlineButton[][] {
	return [
		[
			{ text: "🔁 Kategori lain", callback_data: "act:again" },
			{ text: "📧 Email lain", callback_data: "act:reset" },
		],
	]
}

export function cancelSearchKeyboard(): InlineButton[][] {
	return [[{ text: "❌ Batalkan (kembali ke kategori)", callback_data: "cancel:search" }]]
}

export function notFoundKeyboard(key: CategoryKey): InlineButton[][] {
	return [
		[{ text: "🔄 Cek lagi", callback_data: `cat:${key}` }],
		[
			{ text: "🔁 Kategori lain", callback_data: "act:again" },
			{ text: "📧 Email lain", callback_data: "act:reset" },
		],
	]
}

export function retryKeyboard(): InlineButton[][] {
	return [
		[
			{ text: "\uD83D\uDD04 Cari Lagi", callback_data: "act:again" },
			{ text: "\uD83D\uDCE7 Email Lain", callback_data: "act:reset" },
		],
	]
}
