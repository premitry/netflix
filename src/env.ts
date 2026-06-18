export interface Env {
	DB: D1Database
	BOT_TOKEN: string
	WEBHOOK_SECRET: string
	// Opsional: kunci enkripsi backup (AES-GCM). Kalau kosong, backup disimpan plaintext.
	BACKUP_KEY?: string
	SEARCH_LOOKBACK?: string
	RATE_LIMIT_PER_MIN?: string
	SESSION_TTL_HOURS?: string
	BACKUP_RETENTION?: string
	TZ_OFFSET?: string
	// Auto-refresh pencarian bot (ms antar cek & jumlah maksimal percobaan).
	AUTO_REFRESH_MS?: string
	AUTO_REFRESH_MAX?: string
}
