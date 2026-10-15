// Storage for showcases. Postgres when DATABASE_URL is set (Railway), an in-memory map otherwise
// (local dev). Every showcase keeps its full chat thread, research and generated prototype, so an
// admin can list them later with `railway connect Postgres`:
//   select id, first_name, idea, status, created_at from showcases order by created_at desc;
import pg from "pg";

const COLUMNS = ["first_name", "idea", "status", "step", "transcript", "research", "spec", "html", "error", "ip_hash", "usage", "log", "shots", "checks"];
const JSON_COLUMNS = new Set(["transcript", "research", "spec", "usage", "log", "shots", "checks"]);

let pool;
const memory = new Map();

export async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.log("[db] no DATABASE_URL, using in-memory store");
    return;
  }
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  await pool.query(`
    create table if not exists showcases (
      id uuid primary key,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      first_name text,
      idea text not null,
      status text not null default 'interview',
      step int not null default 0,
      transcript jsonb not null default '[]',
      research jsonb,
      spec jsonb,
      html text,
      error text,
      ip_hash text,
      usage jsonb not null default '[]'
    );
    -- Build progress (shown live), browser-test screenshots, and what the test found.
    alter table showcases add column if not exists log jsonb not null default '[]';
    alter table showcases add column if not exists shots jsonb;
    alter table showcases add column if not exists checks jsonb;
    create index if not exists showcases_created_idx on showcases (created_at desc);
    create index if not exists showcases_ip_idx on showcases (ip_hash, created_at desc);
  `);
  console.log("[db] postgres ready");
}

export async function createShowcase(row) {
  const record = { transcript: [], usage: [], log: [], status: "interview", step: 0, ...row, created_at: new Date() };
  if (!pool) {
    memory.set(record.id, record);
    return record;
  }
  const cols = ["id", ...COLUMNS.filter((c) => c in record)];
  const vals = cols.map((c) => (JSON_COLUMNS.has(c) ? JSON.stringify(record[c]) : record[c]));
  await pool.query(
    `insert into showcases (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
    vals,
  );
  return record;
}

export async function getShowcase(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  // Copy, so a caller holding a row sees a snapshot (like Postgres) and not later updates.
  if (!pool) return memory.has(id) ? { ...memory.get(id) } : null;
  const { rows } = await pool.query("select * from showcases where id = $1", [id]);
  return rows[0] ?? null;
}

export async function updateShowcase(id, patch) {
  if (!pool) {
    const row = memory.get(id);
    if (row) Object.assign(row, patch);
    return;
  }
  const cols = COLUMNS.filter((c) => c in patch);
  if (!cols.length) return;
  const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(", ");
  const vals = cols.map((c) => (JSON_COLUMNS.has(c) ? JSON.stringify(patch[c]) : patch[c]));
  await pool.query(`update showcases set ${sets}, updated_at = now() where id = $1`, [id, ...vals]);
}

/** How many showcases this visitor started in the last hour, and how many builds ran today overall. */
export async function counts(ipHash) {
  if (!pool) {
    const hourAgo = Date.now() - 3600_000;
    const dayAgo = Date.now() - 86400_000;
    const all = [...memory.values()];
    return {
      ipLastHour: all.filter((r) => r.ip_hash === ipHash && +r.created_at > hourAgo).length,
      buildsToday: all.filter((r) => r.html && +r.created_at > dayAgo).length,
    };
  }
  const { rows } = await pool.query(
    `select
       count(*) filter (where ip_hash = $1 and created_at > now() - interval '1 hour')::int as "ipLastHour",
       count(*) filter (where status in ('building','ready') and created_at > now() - interval '1 day')::int as "buildsToday"
     from showcases where created_at > now() - interval '1 day'`,
    [ipHash],
  );
  return rows[0];
}

/** Every showcase, newest first, without the heavy columns (for the organizer list). */
export async function listShowcases() {
  if (!pool) return [...memory.values()].sort((a, b) => b.created_at - a.created_at);
  const { rows } = await pool.query(
    "select id, created_at, first_name, idea, status, spec, checks, usage from showcases order by created_at desc",
  );
  return rows;
}
