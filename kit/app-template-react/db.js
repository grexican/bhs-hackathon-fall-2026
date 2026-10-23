// The app's database: one SQLite file, built into Node (no install, no Docker, no account).
// On your laptop it's ./data/app.db. Online, the hub sets DATABASE_PATH=/data/app.db, a disk that
// survives every deploy. Never save data anywhere else online: it would vanish on the next deploy.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const file = process.env.DATABASE_PATH || "./data/app.db";
fs.mkdirSync(path.dirname(file), { recursive: true });

export const db = new DatabaseSync(file);

// Tables are created here the first time the app starts. Add your own below this one.
db.exec(`
  create table if not exists taps (
    id integer primary key,
    at text not null default (datetime('now'))
  );
`);
