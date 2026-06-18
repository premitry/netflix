// Entry point Worker: webhook Telegram, dashboard web, dan cron backup.
import type { Env } from "./env"
import { handleUpdate, remindExpiry, notifyExpired } from "./bot"
import { handleWeb } from "./web"
import * as backup from "./backup"
import * as db from "./db"

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url)
		const path = url.pathname

		// Health check
		if (request.method === "GET" && path === "/healthz") {
			return new Response("FLIXVAULT OK \u00b7 build 2026-06-11r", { status: 200 })
		}

		// Webhook Telegram: /webhook/<WEBHOOK_SECRET>
		if (path.startsWith("/webhook/")) {
			if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 })
			const secret = path.slice("/webhook/".length)
			if (secret !== env.WEBHOOK_SECRET) return new Response("Forbidden", { status: 403 })
			let update: any
			try {
				update = await request.json()
			} catch {
				return new Response("Bad Request", { status: 400 })
			}
			// Proses di background supaya Telegram cepat menerima 200.
			ctx.waitUntil(
				handleUpdate(update, env).catch((e) => console.error("handleUpdate", e)),
			)
			return new Response("ok", { status: 200 })
		}

		// Sisanya: dashboard web + API
		try {
			return await handleWeb(request, env, url)
		} catch (e: any) {
			return new Response("Server Error: " + String(e?.message || e), { status: 500 })
		}
	},

	// Cron tiap jam (lihat wrangler.toml: "0 * * * *").
	async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(runScheduledBackup(env))
		ctx.waitUntil(runExpiryReminders(env))
	},
}

async function runScheduledBackup(env: Env): Promise<void> {
	// Master ON/OFF auto backup (default ON bila belum pernah diset).
	if ((await db.getSetting(env.DB, "backup_enabled")) === "0") return
	const offset = parseInt(env.TZ_OFFSET || "7", 10)
	const nowLocal = new Date(Date.now() + offset * 3600000)
	const localHour = nowLocal.getUTCHours()
	const targetHour = parseInt((await db.getSetting(env.DB, "backup_hour")) || "3", 10)
	if (localHour !== targetHour) return
	// Interval backup (hari). Lewati bila belum mencapai interval sejak backup terjadwal terakhir.
	const intervalDays = Math.max(1, parseInt((await db.getSetting(env.DB, "backup_interval_days")) || "1", 10))
	const todayDate = nowLocal.toISOString().slice(0, 10)
	const lastDate = await db.getSetting(env.DB, "backup_last_scheduled_date")
	if (lastDate) {
		const elapsed = Math.floor((Date.parse(todayDate) - Date.parse(lastDate)) / 86400000)
		if (elapsed < intervalDays) return
	}
	// Hindari dobel backup dalam jam yang sama.
	const todayKey = nowLocal.toISOString().slice(0, 13)
	const last = await db.getSetting(env.DB, "backup_last_scheduled")
	if (last === todayKey) return
	await backup.createBackup(env, "scheduled", { label: "otomatis-" + todayKey })
	await db.setSetting(env.DB, "backup_last_scheduled", todayKey)
	await db.setSetting(env.DB, "backup_last_scheduled_date", todayDate)
}

// Pengingat langganan H-3 dan H-1 (sekali per hari, pada jam tertentu).
async function runExpiryReminders(env: Env): Promise<void> {
	if (!env.BOT_TOKEN) return
	const offset = parseInt(env.TZ_OFFSET || "7", 10)
	const nowLocal = new Date(Date.now() + offset * 3600000)
	const reminderHour = parseInt((await db.getSetting(env.DB, "reminder_hour")) || "9", 10)
	if (nowLocal.getUTCHours() !== reminderHour) return
	const todayKey = nowLocal.toISOString().slice(0, 10)
	if ((await db.getSetting(env.DB, "reminder_last")) === todayKey) return
	await db.setSetting(env.DB, "reminder_last", todayKey)
	const buyers = await db.listBuyers(env.DB)
	for (const b of buyers) {
		if (!b.telegram_id || !b.expired_at || b.status !== "active") continue
		const daysLeft = Math.ceil((Date.parse(b.expired_at) - Date.now()) / 86400000)
		if (daysLeft === 3 || daysLeft === 1) {
			await remindExpiry(env, b.telegram_id, daysLeft, b.expired_at)
		} else if (daysLeft <= 0 && daysLeft >= -2) {
			// H-0: masa aktif benar-benar habis. Kirim sekali per masa aktif (penanda per member).
			const key = "expired_notified:" + b.telegram_id
			if ((await db.getSetting(env.DB, key)) !== b.expired_at) {
				await notifyExpired(env, b.telegram_id, b.expired_at)
				await db.setSetting(env.DB, key, b.expired_at)
			}
		}
	}
}
