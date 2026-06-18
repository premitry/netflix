// Definisi kategori + deteksi multi-bahasa + ekstraksi kode/link Netflix.
import { parseEmail } from "./mime"
import type { RawMessage } from "./imap"

export type CategoryKey =
	| "signin"
	| "household"
	| "tvlink"
	| "resetpw"
	| "resetemail"

export type Category = {
	key: CategoryKey
	label: string
	public: boolean // true = bisa diakses publik; false = hanya buyer/admin
	kind: "code" | "link"
}

export const CATEGORIES: Record<CategoryKey, Category> = {
	signin: { key: "signin", label: "\uD83D\uDD11 Kode Masuk", public: true, kind: "code" },
	household: { key: "household", label: "\uD83C\uDFE0 Household", public: true, kind: "link" },
	tvlink: { key: "tvlink", label: "\uD83D\uDCFA Link TV", public: true, kind: "link" },
	resetpw: { key: "resetpw", label: "\uD83D\uDD13 Reset Password", public: false, kind: "link" },
	resetemail: { key: "resetemail", label: "\uD83D\uDCE7 Reset Email", public: false, kind: "code" },
}

// Kata kunci subjek multi-bahasa (auto-deteksi bahasa: cukup cocok salah satu).
const KEYWORDS: Record<CategoryKey, string[]> = {
	signin: [
		"sign-in code", "sign in code", "login code", "your code",
		"kode masuk", "kode login", "temporary access code", "verification code",
		"c\u00f3digo de inicio", "code de connexion", "anmeldecode", "\u30b5\u30a4\u30f3\u30a4\u30f3",
	],
	household: [
		"household", "netflix household", "rumah tangga", "update your household",
		"temporarily", "traveling", "hogar", "foyer", "haushalt",
		"kode akses sementara", "akses sementara", "temporary access",
		"dapatkan kode", "get code", "luar rumah", "away from home",
		"acceso temporal", "acesso tempor\u00e1rio", "acc\u00e8s temporaire",
		"accesso temporaneo", "tijdelijke toegang", "ge\u00e7ici eri\u015fim",
		"\u4e00\u6642\u7684\u306a\u30a2\u30af\u30bb\u30b9", "\uc784\uc2dc \uc561\uc138\uc2a4", "\u4e34\u65f6\u8bbf\u95ee",
	],
	tvlink: [
		"tv", "watch", "device", "link", "perangkat", "connect your tv",
		"tonton", "televisi", "dispositivo", "appareil",
	],
	resetpw: [
		"reset your password", "password reset", "reset password", "atur ulang kata sandi",
		"reset kata sandi", "forgot password", "restablecer", "r\u00e9initialiser", "passwort",
	],
	resetemail: [
		"verify your email", "email change", "update your email", "verifikasi email",
		"ubah email", "confirm your email", "verificar", "v\u00e9rifier", "e-mail",
		"confirm your account change", "account change", "confirm your account",
		"change with this code", "with this code", "konfirmasi akun", "kode konfirmasi",
	],
}

export type SearchHit = {
	found: boolean
	value?: string // kode atau link
	subject?: string
	date?: string
}

function parseDate(d?: string): number {
	if (!d) return 0
	const t = Date.parse(d)
	return Number.isNaN(t) ? 0 : t
}

function extractCode(text: string, digits: number): string | undefined {
	const re = new RegExp(`(?<!\\d)(\\d{${digits}})(?!\\d)`, "g")
	const matches = text.match(re)
	if (!matches) return undefined
	// Prioritaskan angka yang muncul tepat setelah kata "code/kode/codigo".
	const low = text.toLowerCase()
	for (const kw of ["code", "kode", "codigo", "c\u00f3digo"]) {
		const i = low.indexOf(kw)
		if (i < 0) continue
		const seg = text.slice(i, i + 40)
		const m2 = seg.match(re)
		if (m2) return m2[0]
	}
	return matches[0]
}

function extractNetflixLink(html: string, text: string): string | undefined {
	const source = html || text
	const re = /https?:\/\/[^"'\s<>]*netflix\.com\/[^"'\s<>]*/gi
	const all = source.match(re)
	if (!all || all.length === 0) return undefined
	// Prioritaskan link aksi (account / update / verify / confirm)
	const priority = all.find((u) =>
		/(account|update|verify|confirm|reset|household|travel|tv|code|login)/i.test(u),
	)
	return (priority || all[0]).replace(/&amp;/g, "&")
}

function matchesCategory(subject: string, text: string, cat: CategoryKey): boolean {
	const hay = (subject + " " + text).toLowerCase()
	return KEYWORDS[cat].some((kw) => hay.includes(kw.toLowerCase()))
}

// Cari hasil terbaru dari daftar pesan mentah untuk kategori tertentu.
export function findLatest(
	messages: RawMessage[],
	cat: CategoryKey,
): SearchHit {
	const category = CATEGORIES[cat]
	const parsed = messages
		.map((m) => ({ m, p: parseEmail(m.raw) }))
		.map((x) => ({
			...x,
			ts: parseDate(x.p.date) || parseDate(x.m.internalDate),
		}))
		.sort((a, b) => b.ts - a.ts)

	for (const item of parsed) {
		if (!matchesCategory(item.p.subject, item.p.text, cat)) continue
		let value: string | undefined
		if (category.kind === "code") {
			const digits = cat === "signin" ? 4 : 6
			value = extractCode(item.p.text, digits)
		} else {
			value = extractNetflixLink(item.p.html, item.p.text)
		}
		if (value) {
			return {
				found: true,
				value,
				subject: item.p.subject,
				date: item.p.date || item.m.internalDate,
			}
		}
	}
	return { found: false }
}

const HOUSEHOLD_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

// Strip HTML lalu cari kode 4 digit (mendukung "1234" atau "1 2 3 4").
function extractAccessCode(html: string): string | undefined {
	const text = html
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&[a-z#0-9]+;/gi, " ")
		.replace(/\s+/g, " ")
	const grab = (s: string): string | undefined => {
		const m = s.match(/(?<!\d)\d\s?\d\s?\d\s?\d(?!\d)/)
		return m ? m[0].replace(/\s/g, "") : undefined
	}
	const low = text.toLowerCase()
	const KW = [
		// Frasa spesifik per bahasa (prioritas tinggi)
		"enter this code", "access code", "verification code",
		"kode akses", "masukkan kode", "kode verifikasi",
		"c\u00f3digo de acceso", "c\u00f3digo de acesso", "ingresa este c\u00f3digo", "insira este c\u00f3digo",
		"code d'acc\u00e8s", "code de connexion", "saisissez ce code",
		"zugangscode", "anmeldecode", "code eingeben",
		"codice di accesso", "inserisci questo codice", "toegangscode",
		"eri\u015fim kodu", "kod dost\u0119pu", "\u043a\u043e\u0434 \u0434\u043e\u0441\u0442\u0443\u043f\u0430",
		"\u30a2\u30af\u30bb\u30b9\u30b3\u30fc\u30c9", "\uc561\uc138\uc2a4 \ucf54\ub4dc", "\u8bbf\u95ee\u4ee3\u7801", "\u9a8c\u8bc1\u7801",
		// Kata generik (prioritas rendah)
		"c\u00f3digo", "codigo", "code", "kode", "kod",
		"\ucf54\ub4dc", "\u30b3\u30fc\u30c9", "\u4ee3\u7801", "\u043a\u043e\u0434", "m\u00e3", "\u0e23\u0e2b\u0e31\u0e2a",
	]
	for (const kw of KW) {
		const i = low.indexOf(kw)
		if (i < 0) continue
		const c = grab(text.slice(i, i + 80))
		if (c) return c
	}
	return grab(text)
}

// Ikuti link "Dapatkan Kode" Netflix lalu ambil kode 4 digit dari halaman.
// Mengembalikan undefined bila gagal (halaman butuh login/JS atau diblokir).
export async function fetchHouseholdCode(link: string): Promise<string | undefined> {
	const get = async (url: string): Promise<string | undefined> => {
		try {
			const res = await fetch(url, {
				redirect: "follow",
				headers: {
					"User-Agent": HOUSEHOLD_UA,
					"Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
					Accept: "text/html,application/xhtml+xml",
				},
			})
			if (!res.ok) return undefined
			return await res.text()
		} catch {
			return undefined
		}
	}
	const html = await get(link)
	if (!html) return undefined
	const code = extractAccessCode(html)
	if (code) return code
	// Bila kode belum tampil, ikuti satu hop link verify/code di halaman.
	const deep = extractNetflixLink(html, "")
	if (deep && deep !== link && /(verify|code|travel|otp|household|get)/i.test(deep)) {
		const html2 = await get(deep)
		if (html2) return extractAccessCode(html2)
	}
	return undefined
}
