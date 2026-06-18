// IMAP client minimal untuk Cloudflare Workers (TCP Sockets API).
// Mode: "ssl" (implicit TLS / 993) atau "starttls" (upgrade dari 143).

import { connect } from "cloudflare:sockets"

export type ImapSecurity = "ssl" | "starttls"

export type ImapCreds = {
	host: string
	port: number
	user: string
	pass: string
	security?: ImapSecurity
}

export type RawMessage = {
	uid: number
	internalDate?: string
	raw: string
}

export class ImapClient {
	private socket!: Socket
	private writer!: WritableStreamDefaultWriter<Uint8Array>
	private reader!: ReadableStreamDefaultReader<Uint8Array>
	private decoder = new TextDecoder()
	private encoder = new TextEncoder()
	private buffer = ""
	private tag = 0

	constructor(private creds: ImapCreds) {}

	private openSocket(transport: "on" | "starttls"): void {
		this.socket = connect(
			{ hostname: this.creds.host, port: this.creds.port },
			{ secureTransport: transport, allowHalfOpen: false },
		)
		this.writer = this.socket.writable.getWriter()
		this.reader = this.socket.readable.getReader()
	}

	private nextTag(): string {
		this.tag += 1
		return `a${this.tag}`
	}

	private async pull(): Promise<boolean> {
		const { value, done } = await this.reader.read()
		if (done) return false
		if (value) this.buffer += this.decoder.decode(value, { stream: true })
		return true
	}

	private async readLine(): Promise<void> {
		while (!/\r?\n/.test(this.buffer)) {
			if (!(await this.pull())) break
		}
		this.buffer = ""
	}

	private async readUntilTagged(tag: string): Promise<string> {
		const re = new RegExp(`^${tag} (OK|NO|BAD)(.*)$`, "m")
		while (!re.test(this.buffer)) {
			if (!(await this.pull())) break
		}
		const response = this.buffer
		const m = response.match(re)
		if (!m) throw new Error(`IMAP: tidak ada respons untuk ${tag}`)
		if (m[1] !== "OK") throw new Error(`IMAP ${m[1]}:${m[2]}`)
		this.buffer = ""
		return response
	}

	private async send(command: string): Promise<string> {
		const tag = this.nextTag()
		await this.writer.write(this.encoder.encode(`${tag} ${command}\r\n`))
		return this.readUntilTagged(tag)
	}

	async connectAndLogin(): Promise<void> {
		const security = this.creds.security || "ssl"
		if (security === "starttls") {
			this.openSocket("starttls")
			await this.readLine()
			await this.send("STARTTLS")
			this.reader.releaseLock()
			this.writer.releaseLock()
			this.socket = this.socket.startTls()
			this.writer = this.socket.writable.getWriter()
			this.reader = this.socket.readable.getReader()
			this.buffer = ""
		} else {
			this.openSocket("on")
			await this.readLine()
		}
		const u = this.creds.user.replace(/"/g, '\\"')
		const p = this.creds.pass.replace(/"/g, '\\"')
		await this.send(`LOGIN "${u}" "${p}"`)
	}

	async selectInbox(): Promise<void> {
		await this.send("SELECT INBOX")
	}

	// Cari UID email dari Netflix yang ditujukan ke alamat tertentu.
	// Mencoba header TO lalu (fallback) gabungan TO/Delivered-To.
	async searchNetflixTo(toAddress: string): Promise<number[]> {
		const safe = toAddress.replace(/"/g, '\\"')
		let resp = await this.send(`UID SEARCH FROM "netflix" TO "${safe}"`)
		let uids = this.parseSearch(resp)
		if (uids.length === 0) {
			// fallback: cari via header Delivered-To (catch-all)
			resp = await this.send(
				`UID SEARCH FROM "netflix" HEADER "Delivered-To" "${safe}"`,
			)
			uids = this.parseSearch(resp)
		}
		return uids
	}

	private parseSearch(resp: string): number[] {
		const line = resp.split(/\r?\n/).find((l) => l.startsWith("* SEARCH"))
		if (!line) return []
		return line
			.replace("* SEARCH", "")
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.map((n) => parseInt(n, 10))
			.filter((n) => !Number.isNaN(n))
	}

	async fetchRaw(uid: number): Promise<RawMessage> {
		const resp = await this.send(`UID FETCH ${uid} (BODY.PEEK[] INTERNALDATE)`)
		const literal = resp.match(/\{(\d+)\}\r?\n/)
		let raw = ""
		if (literal) {
			const size = parseInt(literal[1], 10)
			const start = (literal.index || 0) + literal[0].length
			raw = resp.slice(start, start + size)
		}
		const dm = resp.match(/INTERNALDATE "([^"]+)"/)
		return { uid, raw, internalDate: dm?.[1] }
	}

	async logout(): Promise<void> {
		try {
			await this.send("LOGOUT")
		} catch {
			/* ignore */
		} finally {
			try {
				await this.writer.close()
			} catch {}
			try {
				await this.socket.close()
			} catch {}
		}
	}
}

// Uji koneksi+login IMAP; pakai untuk verifikasi saat user menyimpan setting.
export async function testImap(
	creds: ImapCreds,
): Promise<{ ok: boolean; error?: string }> {
	const client = new ImapClient(creds)
	try {
		await client.connectAndLogin()
		await client.selectInbox()
		return { ok: true }
	} catch (e: any) {
		return { ok: false, error: String(e?.message || e).slice(0, 200) }
	} finally {
		try {
			await client.logout()
		} catch {}
	}
}
