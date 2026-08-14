const { query } = require('../db/connection');

const findRunningByNim = async (nim) => {
  const { rows } = await query(
    "SELECT * FROM containers WHERE nim = $1 AND status = 'running' ORDER BY created_at DESC",
    [nim]
  );
  return rows;
};

const findFirstRunningByNim = async (nim) => {
  const { rows } = await query(
    "SELECT * FROM containers WHERE nim = $1 AND status = 'running' ORDER BY created_at DESC LIMIT 1",
    [nim]
  );
  return rows[0] || null;
};

const findRunningByIdAndNim = async (id, nim) => {
  const { rows } = await query(
    "SELECT * FROM containers WHERE id = $1 AND nim = $2 AND status = 'running'",
    [id, nim]
  );
  return rows[0] || null;
};

const countRunningByNim = async (nim) => {
  const { rows } = await query(
    "SELECT COUNT(*)::int as c FROM containers WHERE nim = $1 AND status = 'running'",
    [nim]
  );
  return rows[0].c;
};

const findAllRunningPorts = async () => {
  const { rows } = await query("SELECT ssh_port FROM containers WHERE status = 'running'", []);
  return new Set(rows.map((r) => r.ssh_port));
};

const findExpired = async (now) => {
  const { rows } = await query(
    "SELECT * FROM containers WHERE status = 'running' AND expires_at <= $1",
    [now]
  );
  return rows;
};

const insert = async ({ nim, containerId, containerName, sshPort, linuxUsername, passwordHash, expiresAt }) => {
  const { rows } = await query(
    `INSERT INTO containers (nim, container_id, container_name, ssh_port, linux_username, linux_password_hash, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'running', $7)
     RETURNING *`,
    [nim, containerId, containerName, sshPort, linuxUsername, passwordHash, expiresAt]
  );
  return rows[0];
};

const findById = async (id) => {
  const { rows } = await query('SELECT * FROM containers WHERE id = $1', [id]);
  return rows[0] || null;
};

const markDestroyed = async (id) => {
  await query("UPDATE containers SET status = 'destroyed', destroyed_at = now() WHERE id = $1", [id]);
};

// ==== Admin queries ====

const findAllRunningWithStudent = async () => {
  const { rows } = await query(
    `SELECT c.*, s.nama as student_nama
     FROM containers c
     JOIN students s ON s.nim = c.nim
     WHERE c.status = 'running'
     ORDER BY c.created_at DESC`,
    []
  );
  return rows;
};

const getUsageStatsPerStudent = async () => {
  const { rows } = await query(
    `SELECT
       s.nim,
       s.nama,
       COUNT(c.id)::int AS total_containers,
       COUNT(c.id) FILTER (WHERE c.status = 'running')::int AS active_containers,
       MAX(c.created_at) AS last_container_at,
       (SELECT COUNT(*)::int FROM activity_log al WHERE al.nim = s.nim AND al.action = 'login_success') AS login_count
     FROM students s
     LEFT JOIN containers c ON c.nim = s.nim
     GROUP BY s.nim, s.nama
     ORDER BY total_containers DESC, login_count DESC`,
    []
  );
  return rows;
};

const getSummaryStats = async () => {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM students) as total_students,
       (SELECT COUNT(*)::int FROM containers WHERE status = 'running') as active_containers,
       (SELECT COUNT(*)::int FROM containers) as total_containers_ever,
       (SELECT COUNT(*)::int FROM activity_log WHERE action = 'login_success' AND created_at > now() - interval '24 hours') as logins_last_24h`,
    []
  );
  return rows[0];
};

module.exports = {
  findRunningByNim,
  findFirstRunningByNim,
  findRunningByIdAndNim,
  countRunningByNim,
  findAllRunningPorts,
  findExpired,
  insert,
  findById,
  markDestroyed,
  findAllRunningWithStudent,
  getUsageStatsPerStudent,
  getSummaryStats,
};
