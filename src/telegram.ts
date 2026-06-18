// Klien Telegram Bot API minimal.

export type InlineButton = { text: string; callback_data: string }

const API = "https://api.telegram.org"

export class Telegram {
	constructor(private token: string) {}

	private get base(): string {
		return `${API}/bot${this.token}`
	}

	private async call(method: string, body: Record<string, unknown>): Promise<any> {
		const res = await fetch(`${this.base}/${method}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
		return res.json()
	}

	async sendMessage(
		chatId: number,
		text: string,
		keyboard?: InlineButton[][],
	): Promise<any> {
		const body: Record<string, unknown> = {
			chat_id: chatId,
			text,
			parse_mode: "HTML",
			disable_web_page_preview: true,
		}
		if (keyboard) body.reply_markup = { inline_keyboard: keyboard }
		return this.call("sendMessage", body)
	}

	async editMessageText(
		chatId: number,
		messageId: number,
		text: string,
		keyboard?: InlineButton[][],
	): Promise<any> {
		const body: Record<string, unknown> = {
			chat_id: chatId,
			message_id: messageId,
			text,
			parse_mode: "HTML",
			disable_web_page_preview: true,
		}
		if (keyboard) body.reply_markup = { inline_keyboard: keyboard }
		return this.call("editMessageText", body)
	}

	async answerCallbackQuery(id: string, text?: string): Promise<any> {
		return this.call("answerCallbackQuery", {
			callback_query_id: id,
			...(text ? { text } : {}),
		})
	}

	async getChat(chatId: number | string): Promise<any> {
		return this.call("getChat", { chat_id: chatId })
	}

	async deleteMessage(chatId: number, messageId: number): Promise<any> {
		return this.call("deleteMessage", { chat_id: chatId, message_id: messageId })
	}

	async getFile(fileId: string): Promise<any> {
		return this.call("getFile", { file_id: fileId })
	}

	async downloadFile(filePath: string): Promise<string> {
		const res = await fetch(`${API}/file/bot${this.token}/${filePath}`)
		return res.text()
	}

	async sendDocument(
		chatId: number | string,
		filename: string,
		content: string,
		caption?: string,
	): Promise<any> {
		const form = new FormData()
		form.append("chat_id", String(chatId))
		if (caption) form.append("caption", caption)
		form.append("document", new Blob([content], { type: "application/json" }), filename)
		const res = await fetch(`${this.base}/sendDocument`, {
			method: "POST",
			body: form,
		})
		return res.json()
	}
}
