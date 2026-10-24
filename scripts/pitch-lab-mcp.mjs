#!/usr/bin/env node
// Pitch Lab as AI tools: a local MCP server over stdio, so /pitch in Cursor or Claude Code can start or continue a
// student's pitch and feed it what the app's code shows. Registered in .cursor/mcp.json and .mcp.json as "pitch-lab".
// It never answers the Grill: the student does that in Pitch Lab, in their own words. Tokens never appear in a result.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { openBrowser } from "./locker.mjs";
import {
  AUDIENCES,
  PitchLabError,
  addSource,
  baseUrl,
  connectPoll,
  connectStart,
  createPitch,
  getPitch,
  isConnected,
  links,
  listPitches,
  statusText,
  updatePitch,
} from "./pitch-lab.mjs";

const WAIT_MS = Number(process.env.PITCH_LAB_CONNECT_WAIT_MS ?? 60_000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tool = (fn) => async (args) => {
  try {
    return { content: [{ type: "text", text: await fn(args) }] };
  } catch (err) {
    if (!(err instanceof PitchLabError)) process.stderr.write(`${err?.stack ?? err}\n`);
    const msg = err instanceof PitchLabError ? err.message : `Something unexpected went wrong: ${String(err?.message ?? err).split("\n")[0]}`;
    return { content: [{ type: "text", text: msg }], isError: true };
  }
};

const server = new McpServer({ name: "pitch-lab", version: "1.0.0" });
let pending = null;

server.registerTool(
  "pitch_connect",
  {
    description:
      "Connects this laptop to Pitch Lab (once per laptop): opens the browser and returns a code to show the student. They sign in with their school account, check the code and click Allow. Then call pitch_connect_check.",
  },
  tool(async () => {
    if (isConnected()) {
      try {
        const n = (await listPitches()).length;
        return `Already connected to Pitch Lab (${n} pitch${n === 1 ? "" : "es"}). Nothing to do.`;
      } catch (e) {
        if (e.status !== 401) throw e; // an old sign-in that no longer works: connect again below
      }
    }
    const start = await connectStart();
    pending = { deviceCode: start.deviceCode, interval: start.interval ?? 3, expiresAt: Date.now() + (start.expiresIn ?? 900) * 1000 };
    openBrowser(start.url);
    return `Show the student this code: ${start.code}. Ask them to sign in with their school Google account at ${start.url} (it should have opened in the browser), check the code matches, and click Allow. Then call pitch_connect_check.`;
  }),
);

server.registerTool(
  "pitch_connect_check",
  { description: "Waits (up to ~1 minute per call) for the student to click Allow, then saves the sign-in to the kit .env. If it says still waiting, call it again." },
  tool(async () => {
    if (!pending) return isConnected() ? "Already connected." : "No connection is waiting. Call pitch_connect to start one.";
    const until = Math.min(pending.expiresAt, Date.now() + WAIT_MS);
    while (Date.now() < until) {
      const r = await connectPoll(pending.deviceCode);
      if (r.status === "approved") {
        pending = null;
        return `Connected to Pitch Lab as ${r.name || "the student"}. Next: pitch_list to see their pitches, or pitch_create for a new one.`;
      }
      if (r.status === "expired") {
        pending = null;
        return "The code expired before it was allowed. Call pitch_connect to start again.";
      }
      await sleep(pending.interval * 1000);
    }
    return "Still waiting for the student to click Allow. Call pitch_connect_check again.";
  }),
);

server.registerTool(
  "pitch_list",
  { description: "The student's pitches in Pitch Lab, newest first, with how far each one is and its link." },
  tool(async () => {
    const pitches = await listPitches();
    if (!pitches.length) return `No pitches yet. Use pitch_create to start one. (Pitch Lab: ${baseUrl()})`;
    return pitches
      .map((p) => `#${p.id} ${p.title} (for ${p.audience}): ${p.answered} answer${p.answered === 1 ? "" : "s"} judged, ${p.decks} version${p.decks === 1 ? "" : "s"} of the pitch. ${links(p).workspace}`)
      .join("\n");
  }),
);

const setup = {
  title: z.string().min(1).max(80).describe("The app's name, like Lunch Line."),
  idea: z.string().min(1).max(1500).describe("What it is and why it matters, in the STUDENT's words (ask them; don't write it for them)."),
  audience: z.enum(AUDIENCES).describe("Who they pitch to: judges, investors, school (leadership/parents), users, competition, or other."),
  audience_detail: z.string().max(500).optional().describe("Who exactly, and what they care about."),
  goal: z.string().max(300).optional().describe("What the student wants from that audience (a prize, users, a yes, money)."),
  minutes: z.number().int().min(1).max(10).optional().describe("How long they get. Default 3."),
};

server.registerTool(
  "pitch_create",
  { description: "Starts a new pitch in Pitch Lab with the student's setup. Returns its number and links. Then add what the code shows with pitch_add_source.", inputSchema: setup },
  tool(async (s) => {
    const p = await createPitch(s);
    return `Pitch #${p.id} "${s.title}" is started. Add what the app's code shows with pitch_add_source, then send the student to the Grill: ${links(p).grill}`;
  }),
);

server.registerTool(
  "pitch_update_setup",
  {
    description: "Changes a pitch's setup (title, idea, audience, goal, minutes). Only the fields given change.",
    inputSchema: { id: z.number().int(), ...Object.fromEntries(Object.entries(setup).map(([k, v]) => [k, v.optional()])) },
  },
  tool(async ({ id, ...s }) => {
    await updatePitch(id, s);
    return `Updated the setup of #${id}. ${links({ id }).setup}`;
  }),
);

server.registerTool(
  "pitch_add_source",
  {
    description:
      "Adds context the Grill and the pitch can use: a note (title + text) or a web page (url). Use it for what the app's code really shows (what works, what's simulated, the live address, real numbers from the Locker), never for answers to the Grill.",
    inputSchema: {
      id: z.number().int().describe("The pitch number."),
      title: z.string().max(200).optional().describe("For a note: a short title, like 'What the app does (from its code)'."),
      text: z.string().max(20000).optional().describe("For a note: the facts, plainly. Mark anything simulated as simulated."),
      url: z.string().url().optional().describe("Or a web page to read instead, like the app's live address."),
    },
  },
  tool(async ({ id, title, text, url }) => {
    if (!url && !text) throw new PitchLabError("Give either text (a note) or a url.");
    const p = await addSource(id, url ? { url } : { title, text });
    const s = p.sources.at(-1);
    return `Added to #${id}: "${s?.title ?? title ?? url}". It has ${p.sources.length} source${p.sources.length === 1 ? "" : "s"} now. ${links(p).sources}`;
  }),
);

server.registerTool(
  "pitch_status",
  {
    description: "Where one pitch stands: setup, sources, Grill rounds and readiness, open questions, the pitch's version and gaps, and which page to open next.",
    inputSchema: { id: z.number().int().describe("The pitch number.") },
  },
  tool(async ({ id }) => statusText(await getPitch(id))),
);

await server.connect(new StdioServerTransport());
