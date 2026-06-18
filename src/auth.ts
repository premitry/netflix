// Hashing password (PBKDF2-SHA256) & token sesi, pakai Web Crypto (tersedia di Workers).

const ITER = 100000

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

async function derive(
	password: string,
	salt: Uint8Array,
	iterations: number,
): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	)
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
		key,
		256,
	)
	return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16))
	const hash = await derive(password, salt, ITER)
	return `pbkdf2$${ITER}$${b64(salt)}$${b64(hash)}`
}

export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	const parts = stored.split("$")
	if (parts.length !== 4 || parts[0] !== "pbkdf2") return false
	const iterations = parseInt(parts[1], 10)
	const salt = ub64(parts[2])
	const expected = parts[3]
	const hash = await derive(password, salt, iterations)
	return b64(hash) === expected
}

export function randomToken(bytes = 32): string {
	const a = crypto.getRandomValues(new Uint8Array(bytes))
	return Array.from(a)
		.map((x) => x.toString(16).padStart(2, "0"))
		.join("")
}

export function genPassword(len = 10): string {
	const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	const a = crypto.getRandomValues(new Uint8Array(len))
	return Array.from(a)
		.map((x) => chars[x % chars.length])
		.join("")
}
