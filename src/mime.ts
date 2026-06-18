// Parser MIME sederhana: ambil header + body teks/HTML dari email mentah.

export type ParsedEmail = {
	subject: string
	from: string
	to: string
	date?: string
	text: string // gabungan body (HTML sudah di-strip)
	html: string // body HTML mentah (kalau ada)
}

function decodeQuotedPrintable(input: string): string {
	return input
		.replace(/=\r?\n/g, "")
		.replace(/=([0-9A-Fa-f]{2})/g, (_, h) =>
			String.fromCharCode(parseInt(h, 16)),
		)
}

function decodeBase64(input: string): string {
	try {
		const clean = input.replace(/\s+/g, "")
		const bin = atob(clean)
		const bytes = new Uint8Array(bin.length)
		for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
		return new TextDecoder("utf-8").decode(bytes)
	} catch {
		return input
	}
}

// Decode header berenkode RFC 2047 (=?utf-8?B?...?= / =?utf-8?Q?...?=)
function decodeHeader(value: string): string {
	return value.replace(
		/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
		(_, _charset, enc, text) => {
			if (enc.toUpperCase() === "B") return decodeBase64(text)
			return decodeQuotedPrintable(text.replace(/_/g, " "))
		},
	)
}

function splitHeaderBody(raw: string): { head: string; body: string } {
	const idx = raw.search(/\r?\n\r?\n/)
	if (idx === -1) return { head: raw, body: "" }
	const sepLen = raw.slice(idx).match(/^\r?\n\r?\n/)?.[0].length || 2
	return { head: raw.slice(0, idx), body: raw.slice(idx + sepLen) }
}

function getHeader(head: string, name: string): string {
	const lines = head.split(/\r?\n/)
	const lower = name.toLowerCase()
	let collected = ""
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		if (line.toLowerCase().startsWith(lower + ":")) {
			collected = line.slice(line.indexOf(":") + 1).trim()
			// folded lines
			for (let j = i + 1; j < lines.length; j++) {
				if (/^\s/.test(lines[j])) collected += " " + lines[j].trim()
				else break
			}
			break
		}
	}
	return decodeHeader(collected)
}

function decodePart(head: string, body: string): string {
	const enc = getHeader(head, "Content-Transfer-Encoding").toLowerCase()
	if (enc.includes("base64")) return decodeBase64(body)
	if (enc.includes("quoted-printable")) return decodeQuotedPrintable(body)
	return body
}

function stripHtml(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/\s+/g, " ")
		.trim()
}

export function parseEmail(raw: string): ParsedEmail {
	const { head, body } = splitHeaderBody(raw)
	const subject = getHeader(head, "Subject")
	const from = getHeader(head, "From")
	const to = getHeader(head, "To") || getHeader(head, "Delivered-To")
	const date = getHeader(head, "Date") || undefined
	const ctype = getHeader(head, "Content-Type")

	let text = ""
	let html = ""

	const boundaryMatch = ctype.match(/boundary="?([^";]+)"?/i)
	if (boundaryMatch) {
		const boundary = boundaryMatch[1]
		const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))
		for (const part of parts) {
			if (!part.trim() || part.trim() === "--") continue
			const { head: ph, body: pb } = splitHeaderBody(part.replace(/^\r?\n/, ""))
			const pct = getHeader(ph, "Content-Type").toLowerCase()
			const decoded = decodePart(ph, pb)
			if (pct.includes("text/html")) html += decoded
			else if (pct.includes("text/plain")) text += decoded
		}
	} else {
		const decoded = decodePart(head, body)
		if (ctype.toLowerCase().includes("text/html")) html += decoded
		else text += decoded
	}

	const combined = (text + " " + stripHtml(html)).replace(/\s+/g, " ").trim()
	return { subject, from, to, date, text: combined, html }
}
