-- Idempotent schema. Aman dijalankan berkali-kali (CREATE TABLE IF NOT EXISTS / OR REPLACE).

CREATE TABLE IF NOT EXISTS students (
  nim            VARCHAR(20) PRIMARY KEY,
  nama           VARCHAR(150) NOT NULL,
  password_hash  TEXT NOT NULL,
  first_login    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admins (
  id             SERIAL PRIMARY KEY,
  username       VARCHAR(50) UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
