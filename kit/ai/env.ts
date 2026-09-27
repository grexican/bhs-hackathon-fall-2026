// Loads the nearest .env (this folder, then each parent) into process.env without overriding
// anything already set. Lets an app inside the repo share the repo-root .env with zero setup.
import fs from "node:fs";
import path from "node:path";

let loaded = false;

export function loadEnv(start: string = process.cwd()): string | null {
  if (loaded) return null;
  loaded = true;
  let dir = path.resolve(start);
  for (;;) {
    const file = path.join(dir, ".env");
    if (fs.existsSync(file)) {
      for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match || process.env[match[1]] !== undefined) continue;
        process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
      }
      return file;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
