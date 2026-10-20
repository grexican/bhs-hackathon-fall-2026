#!/usr/bin/env node
// The hub (the Locker) as AI tools: a local MCP server over stdio, so Cursor and Claude Code can connect the laptop,
// make projects, fetch keys and deploy without any key ever passing through the chat. It runs the same functions as
// scripts/locker.mjs and writes the .env files itself. Registered in .cursor/mcp.json and .mcp.json as "bhs-locker".
// Every result is short plain text an AI can pass on to a student; tokens and keys are never in any result.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  HUB_OWNED,
  HubError,
  ROOT,
  connectPoll,
  connectStart,
  createProject,
  deployApp,
  isConnected,
  joinProject,
  me,
  openBrowser,
  pullEnv,
  readEnv,
  readLogs,
  setSettings,
} from "./locker.mjs";
import { CODENAME } from "./new-app.mjs";

const NEW_APP = path.join(path.dirname(fileURLToPath(import.meta.url)), "new-app.mjs");
// How long locker_connect / locker_connect_check wait for the student to click Connect before handing back.
const CONNECT_WAIT_MS = Number(process.env.LOCKER_CONNECT_WAIT_MS ?? 110_000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- keeping secrets out ----------

const SECRET_NAME = /TOKEN|SECRET|KEY|PASSWORD|PASS/i;

/** Every secret value on this laptop that a result could leak: the hub sign-in and the apps' keys. */
function secretValues(extra = []) {
  const values = [process.env.LOCKER_TOKEN, readEnv(path.join(ROOT, ".env")).LOCKER_TOKEN, ...extra];
  const apps = path.join(ROOT, "apps");
  for (const dir of fs.existsSync(apps) ? fs.readdirSync(apps) : []) {
    for (const [k, v] of Object.entries(readEnv(path.join(apps, dir, ".env")))) {
      if (SECRET_NAME.test(k) || (HUB_OWNED.has(k) && k !== "LOCKER_URL" && k !== "LOCKER_APP_ID")) values.push(v);
    }
  }
  return values.filter((v) => typeof v === "string" && v.length >= 6);
}

const scrub = (text, extra) => secretValues(extra).reduce((t, v) => t.replaceAll(v, "***"), text);

/** The CLI's messages say "run npm run …"; through MCP the agent should use the matching tool instead. */
function toolWords(message) {
  return message
    .replace(/npm run locker:connect( again)?/g, "the locker_connect tool")
    .replace(/npm run new-app -- ([a-z0-9-]+)/g, "the new_app tool (codename $1)")
    .replace(/npm run locker:join -- ([a-z0-9-]+)/g, "the locker_join_project tool (codename $1)")
    .replace(/npm run locker:env -- ([a-z0-9-]+)/g, "the locker_pull_env tool (codename $1)")
    .replace(/npm run locker:project -- ([a-z0-9-]+)/g, "the locker_create_project tool (codename $1)")
    .replace(/npm run locker:logs -- ([a-z0-9-]+) --build/g, "the locker_logs tool (codename $1, build: true)")
    .replace(/npm run deploy -- ([a-z0-9-]+)/g, "the locker_deploy tool (codename $1)")
    .replace(/ \(see above\)/g, "")
    .replace(/\bRun first: the /g, "First use the ")
    .replace(/\b([Rr])un: the /g, (_, r) => `${r === "R" ? "U" : "u"}se the `);
}

const lastLines = (text, n) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(-n).join("\n");
const ok = (text, extra) => ({ content: [{ type: "text", text: scrub(text, extra) }] });
const fail = (text, extra) => ({ content: [{ type: "text", text: scrub(text, extra) }], isError: true });

/** Runs a tool body; any thrown error becomes a friendly isError result (never a stack trace). */
const tool = (fn, extraSecrets = () => []) => async (args) => {
  try {
    return ok(await fn(args), extraSecrets(args));
  } catch (err) {
    if (!(err instanceof HubError)) process.stderr.write(`${err?.stack ?? err}\n`); // client log only, not the chat
    const said = err?.output ? `\nRailway said:\n${lastLines(err.output, 5)}` : "";
    const msg = err instanceof HubError ? toolWords(err.message) : `Something unexpected went wrong: ${String(err?.message ?? err).split("\n")[0]}`;
    return fail(msg + said, extraSecrets(args));
  }
};

// ---------- formatting ----------

const money = (n) => `$${(n ?? 0).toFixed(2)}`;

function projectLine(p) {
  const role = p.role === "member" ? ", teammate" : p.role === "owner" ? ", owner" : "";
  const parts = [`${p.name} (${p.codename}${role}): ${p.status}`];
  if (p.url) parts.push(`live at ${p.url}`);
  if (p.ai) parts.push(`AI ${money(p.ai.usedUsd)} of $${p.ai.monthlyLimitUsd} this month`);
  if (p.costs) parts.push(`hosting ${money(p.costs.railwayUsdThisMonth)} this month`);
  return `- ${parts.join("; ")}`;
}

// ---------- connecting (the device sign-in can outlast one tool call) ----------

let pending = null; // { deviceId, code, url, interval, expiresAt }

async function waitForApproval() {
  const until = Math.min(Date.now() + CONNECT_WAIT_MS, pending.expiresAt);
  while (Date.now() < until) {
    await sleep(pending.interval * 1000);
    const r = await connectPoll(pending.deviceId);
    if (r.status === "approved") {
      pending = null;
      return `Connected as ${r.student?.name ?? "you"} (${r.student?.email ?? "?"}). The sign-in is saved on this laptop. Next: new_app, then locker_create_project.`;
    }
    if (r.status === "expired") {
      pending.expiresAt = 0;
      break;
    }
  }
  if (Date.now() >= pending.expiresAt) {
    pending = null;
    throw new HubError("The sign-in code expired before it was approved. Call locker_connect again for a new code.", 0);
  }
  return `Still waiting. Ask the student to open ${pending.url}, sign in with their school Google account, check the code ${pending.code} matches, and click Connect. Then call locker_connect_check.`;
}

// ---------- the tools ----------

const codename = z.string().regex(CODENAME, "3–30 lowercase letters, digits or dashes, like lunch-line").describe("The app's codename, like lunch-line (its folder is apps/<codename>/).");

const server = new McpServer({ name: "bhs-locker", version: "1.0.0" });

server.registerTool(
  "locker_status",
  { description: "Shows whether this laptop is connected to the incubator hub, as whom, and the student's projects (role, live URL, AI budget, hosting cost)." },
  tool(async () => {
    if (!isConnected()) return "This laptop isn't connected to the hub yet. Use locker_connect to sign in (it opens the browser).";
    const json = await me();
    const head = `Connected as ${json.student?.name ?? "?"} (${json.student?.email ?? "?"}).`;
    if (!json.projects?.length) return `${head} No projects yet: make one with new_app, then locker_create_project.`;
    return [head, ...json.projects.map(projectLine)].join("\n");
  }),
);

server.registerTool(
  "locker_connect",
  {
    description:
      "Connects this laptop to the hub: opens the browser for the student to sign in with their school Google account and approve a code, then waits up to ~2 minutes. Saves the sign-in to the kit .env itself. If it says 'Still waiting', call locker_connect_check.",
  },
  tool(async () => {
    if (isConnected()) {
      try {
        const json = await me();
        return `Already connected as ${json.student?.name ?? "?"} (${json.student?.email ?? "?"}). Nothing to do.`;
      } catch (e) {
        if (e.status !== 401) throw e; // an old sign-in that no longer works: sign in again below
      }
    }
    const start = await connectStart();
    pending = {
      deviceId: start.deviceId,
      code: start.code,
      url: start.url,
      interval: start.interval ?? 3,
      expiresAt: Date.now() + (start.expiresIn ?? 900) * 1000,
    };
    openBrowser(start.url);
    return waitForApproval();
  }),
);

server.registerTool(
  "locker_connect_check",
  { description: "Keeps waiting (up to ~2 minutes) for the student to approve the sign-in that locker_connect started." },
  tool(async () => {
    if (!pending) {
      return isConnected() ? "Already connected. Use locker_status to see the account." : "No sign-in is waiting. Call locker_connect to start one.";
    }
    return waitForApproval();
  }),
);

server.registerTool(
  "locker_create_project",
  {
    description:
      "Creates the student's project on the hub (hosting + AI key) and writes its keys into apps/<codename>/.env. The folder must exist first (new_app). Takes 10–30 seconds.",
    inputSchema: {
      codename,
      name: z.string().min(1).max(60).optional().describe("Display name, like Lunch Line. Defaults to the codename in title case."),
      pitch: z.string().max(280).optional().describe("One sentence on what the app does."),
      ideaUrl: z.string().url().optional().describe("Link to the idea on the idea lab, if there is one."),
    },
  },
  tool(async ({ codename, name, pitch, ideaUrl }) => {
    const { project: p, keys } = await createProject({ codename, name, pitch: pitch ?? "", ideaUrl });
    const where = p.url ? ` Its address will be ${p.url} after the first deploy.` : "";
    return `${p.name} (${codename}) is ${p.status}.${where} Wrote ${keys.length} settings to apps/${codename}/.env (never commit it). Next: build it, then locker_deploy.`;
  }),
);

server.registerTool(
  "locker_join_project",
  {
    description: "For a teammate: fetches the keys of a project the owner added them to into apps/<codename>/.env. The code must be cloned into apps/<codename>/ first (/bring-my-app).",
    inputSchema: { codename },
  },
  tool(async ({ codename }) => {
    const { project: p, keys } = await joinProject(codename);
    if (!keys) {
      return `You're on ${p.name} (${codename}), but its code isn't on this laptop yet. Ask the owner for the GitHub link, run /bring-my-app <link>, then call locker_join_project again.`;
    }
    return `You're on ${p.name} (${codename}). Wrote ${keys.length} settings to apps/${codename}/.env. Next: run it locally; agree with the owner who ships.`;
  }),
);

server.registerTool(
  "locker_pull_env",
  {
    description: "Re-fetches a project's keys from the hub into apps/<codename>/.env (new laptop, rotated keys, deleted .env). Returns only the key names, never values.",
    inputSchema: { codename },
  },
  tool(async ({ codename }) => {
    const { keys } = await pullEnv(codename);
    return `Wrote ${keys.length} settings to apps/${codename}/.env: ${keys.join(", ")}. Never commit it.`;
  }),
);

// Values go through a shell to the Railway tool, so keep them to characters that pass through unchanged.
const SAFE_VALUE = /^[^&|<>^%"`$\r\n]*$/;

server.registerTool(
  "locker_set",
  {
    description:
      "Sets app settings (like LOCKER_GATE=1) on the server and in apps/<codename>/.env, without a redeploy; they apply on the next locker_deploy. Keys from the hub can't be set. For a secret the student would have to paste into chat, have them run npm run locker:set in the terminal instead.",
    inputSchema: {
      codename,
      settings: z
        .record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Setting names are letters, digits and _"), z.string().max(2000))
        .refine((s) => Object.keys(s).length > 0, "Give at least one setting")
        .describe('The settings to set, like {"LOCKER_GATE": "1"}.'),
    },
  },
  tool(
    async ({ codename, settings }) => {
      const bad = Object.entries(settings).find(([, v]) => !SAFE_VALUE.test(v));
      if (bad) throw new HubError(`The value for ${bad[0]} has a character the tool can't pass safely (& | < > ^ % " \` $ or a line break). Have the student run it in the terminal: npm run locker:set -- ${codename} ${bad[0]}=...`, 0);
      const keys = setSettings(codename, settings);
      return `Saved ${keys.join(", ")} on the server and in apps/${codename}/.env. They apply on the next locker_deploy.`;
    },
    ({ settings }) => Object.values(settings ?? {}),
  ),
);

server.registerTool(
  "locker_deploy",
  {
    description:
      "Uploads apps/<codename>/ to its hosting slot and returns right away; the build then takes 1–3 minutes. Returns the live URL. Check progress with locker_logs (build: true).",
    inputSchema: { codename },
  },
  tool(async ({ codename }) => {
    const { output, appUrl } = deployApp(codename);
    const said = lastLines(output, 3);
    const url = appUrl ? ` Then open ${appUrl} (${appUrl}/health should say ok).` : "";
    return `Uploaded apps/${codename}/. The build takes 1–3 minutes.${url} Check the build with locker_logs (codename ${codename}, build: true).${said ? `\nRailway said:\n${said}` : ""}`;
  }),
);

server.registerTool(
  "locker_logs",
  {
    description: "Shows the latest log lines of a deployed app: the running app by default, or the build with build: true.",
    inputSchema: {
      codename,
      build: z.boolean().optional().describe("true for the build logs (why a deploy failed); false or left out for the running app."),
      lines: z.number().int().min(1).max(500).optional().describe("How many lines, default 50."),
    },
  },
  tool(async ({ codename, build = false, lines = 50 }) => {
    const text = lastLines(readLogs(codename, { build, lines }), lines);
    return text ? `Last ${build ? "build" : "app"} logs for ${codename}:\n${text}` : `No ${build ? "build" : "app"} logs for ${codename} yet. Deploy first with locker_deploy, or try again in a minute.`;
  }),
);

server.registerTool(
  "new_app",
  {
    description: "Creates apps/<codename>/ (its own git repo with a first commit), ready to build in. Do this before locker_create_project.",
    inputSchema: {
      codename,
      name: z.string().min(1).max(60).optional().describe("Display name, like Lunch Line. Defaults to the codename in title case."),
    },
  },
  tool(async ({ codename, name }) => {
    const run = spawnSync(process.execPath, [NEW_APP, codename, ...(name ? ["--name", name] : [])], { cwd: ROOT, encoding: "utf8" });
    if (run.status !== 0) throw new HubError((run.stderr || run.stdout || "new-app failed.").replace(/^✗ /, "").trim(), 0);
    return `${run.stdout.split(/\r?\n/)[0]} Next: build in apps/${codename}/; when it should go online, locker_create_project.`;
  }),
);

await server.connect(new StdioServerTransport());
