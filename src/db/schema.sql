-- Idempotent schema. Aman dijalankan berkali-kali (CREATE TABLE IF NOT EXISTS / OR REPLACE).

CREATE TABLE IF NOT EXISTS students (
  nim               VARCHAR(20) PRIMARY KEY,
  nama              VARCHAR(150) NOT NULL,
  password_hash     TEXT NOT NULL,
  first_login       BOOLEAN NOT NULL DEFAULT TRUE,
  preferred_language VARCHAR(5) NOT NULL DEFAULT 'en',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS - aman dijalankan berkali-kali, dan aman
-- juga untuk database yang sudah ada dari sebelum kolom ini ditambahkan (migrasi
-- idempotent tanpa perlu tool migration terpisah).
ALTER TABLE students ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) NOT NULL DEFAULT 'en';

CREATE TABLE IF NOT EXISTS admins (
  id                SERIAL PRIMARY KEY,
  username          VARCHAR(50) UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,
  preferred_language VARCHAR(5) NOT NULL DEFAULT 'en',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admins ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) NOT NULL DEFAULT 'en';

CREATE TABLE IF NOT EXISTS containers (
  id                    SERIAL PRIMARY KEY,
  nim                   VARCHAR(20) NOT NULL REFERENCES students(nim),
  container_id          VARCHAR(100) NOT NULL,
  container_name        VARCHAR(150) NOT NULL,
  ssh_port              INTEGER NOT NULL,
  linux_username        VARCHAR(50) NOT NULL,
  linux_password_hash   TEXT NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'running', -- running | destroyed
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at            TIMESTAMPTZ NOT NULL,
  destroyed_at          TIMESTAMPTZ
);

-- Port cuma perlu unik SELAMA container itu masih 'running'.
-- Partial unique index ini juga yang bikin port bisa dipakai ulang setelah container lama mati,
-- tanpa perlu hapus row lama secara manual.
CREATE UNIQUE INDEX IF NOT EXISTS idx_containers_ssh_port_running
  ON containers (ssh_port) WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_containers_nim ON containers (nim);
CREATE INDEX IF NOT EXISTS idx_containers_status ON containers (status);

CREATE TABLE IF NOT EXISTS activity_log (
  id          SERIAL PRIMARY KEY,
  nim         VARCHAR(20),
  action      VARCHAR(50) NOT NULL,
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_nim ON activity_log (nim);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log (action);

-- === API Gateway ===
-- API key untuk akses programatik ke /api/v1/* dari sistem eksternal (mis. integrasi
-- dengan tool akademik lain). Key ASLI cuma ditampilkan sekali saat dibuat - yang
-- disimpan di sini cuma hash-nya (pola sama seperti password, pakai bcrypt).
-- "key_prefix" disimpan terpisah (8 karakter awal, tidak sensitif) supaya admin bisa
-- mengenali key mana yang mana di UI tanpa perlu tahu key lengkapnya.
CREATE TABLE IF NOT EXISTS api_keys (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  key_prefix      VARCHAR(12) NOT NULL,
  key_hash        TEXT NOT NULL,
  created_by      VARCHAR(50), -- username admin yang membuat
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys (id) WHERE revoked_at IS NULL;
