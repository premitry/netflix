-- ============ NETVAULT PRO - Skema D1 ============

-- Admin (identitas Telegram)
CREATE TABLE IF NOT EXISTS admins (
  telegram_id INTEGER PRIMARY KEY,
  added_at    TEXT NOT NULL
);

-- Akun login web untuk admin (email + password hash)
CREATE TABLE IF NOT EXISTS admin_accounts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

-- Buyer (reseller)
CREATE TABLE IF NOT EXISTS buyers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id   INTEGER UNIQUE,
  name          TEXT NOT NULL,
  email_login   TEXT UNIQUE,
  password_hash TEXT,
  password_plain TEXT,
  expired_at    TEXT,
  status        TEXT NOT NULL DEFAULT 'active',  -- active | suspended
  created_by    INTEGER,
  created_at    TEXT NOT NULL
);

-- Server IMAP milik buyer (1 IMAP per buyer; bisa banyak domain)
CREATE TABLE IF NOT EXISTS imap_servers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_id   INTEGER NOT NULL UNIQUE,
  host       TEXT NOT NULL,
  port       INTEGER NOT NULL DEFAULT 993,
  username   TEXT NOT NULL,
  password   TEXT NOT NULL,                      -- plaintext (sesuai pilihan)
  security   TEXT NOT NULL DEFAULT 'ssl',        -- ssl (993) | starttls (143)
  updated_at TEXT NOT NULL
);

-- Mapping domain -> buyer (input manual, unik)
CREATE TABLE IF NOT EXISTS domains (
  domain         TEXT PRIMARY KEY,
  buyer_id       INTEGER NOT NULL,
  imap_server_id INTEGER NOT NULL,
  created_at     TEXT NOT NULL
);

-- State wizard percakapan bot
CREATE TABLE IF NOT EXISTS bot_state (
  telegram_id INTEGER PRIMARY KEY,
  step        TEXT NOT NULL,
  draft       TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL
);

-- Log pencarian (audit + rate limit)
CREATE TABLE IF NOT EXISTS search_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER,
  email       TEXT,
  category    TEXT,
  result      TEXT,
  created_at  TEXT NOT NULL
);

-- Sesi login web
CREATE TABLE IF NOT EXISTS web_sessions (
  token      TEXT PRIMARY KEY,
  buyer_id   INTEGER,
  is_admin   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Pengaturan (key-value): jadwal backup, toggle, dll
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Arsip backup (snapshot JSON, opsional terenkripsi)
CREATE TABLE IF NOT EXISTS backups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT,
  kind       TEXT NOT NULL,                       -- scheduled | change | manual
  encrypted  INTEGER NOT NULL DEFAULT 0,
  data       TEXT NOT NULL,
  rows       INTEGER,
  created_at TEXT NOT NULL
);

-- Audit log aksi admin (suspend/hapus/reset/reaktivasi)
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  target     TEXT,
  detail     TEXT,
  created_at TEXT NOT NULL
);

-- Pelacak semua user yang pernah berinteraksi dengan bot (admin + member + lainnya)
CREATE TABLE IF NOT EXISTS bot_users (
  telegram_id INTEGER PRIMARY KEY,
  first_seen  TEXT NOT NULL,
  last_seen   TEXT NOT NULL,
  username    TEXT
);

CREATE INDEX IF NOT EXISTS idx_search_log_user ON search_log (telegram_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_domains_buyer ON domains (buyer_id);

-- Whitelist user per member (opsional; kosong = terbuka untuk semua)
CREATE TABLE IF NOT EXISTS member_whitelist (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_id    INTEGER NOT NULL,
  telegram_id INTEGER,
  username    TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wl_buyer ON member_whitelist (buyer_id);
