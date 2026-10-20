#!/usr/bin/env node
// Prints a free TCP port picked at random, so several dev servers can run side by side.
// Usage: `npm run port`  →  prints e.g. 4817
import net from "node:net";
import { pathToFileURL } from "node:url";

const MIN = 4100;
const MAX = 5999;
// Ports other local tools commonly grab; never hand these out.
const AVOID = new Set([4200, 4321, 4173, 5000, 5173, 5174, 5432, 5555]);

function isFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

export async function freePort(taken = new Set()) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const port = MIN + Math.floor(Math.random() * (MAX - MIN));
    if (AVOID.has(port) || taken.has(port)) continue;
    if ((await isFree(port)) && !(await isListening(port))) return port;
  }
  throw new Error(`No free port found between ${MIN} and ${MAX}`);
}

// True when something answers on the port (dev servers may bind IPv4 or IPv6 localhost).
export function isListening(port) {
  const probe = (host) =>
    new Promise((resolve) => {
      const socket = net.connect({ port, host });
      socket.setTimeout(500);
      socket.once("connect", () => { socket.destroy(); resolve(true); });
      socket.once("timeout", () => { socket.destroy(); resolve(false); });
      socket.once("error", () => resolve(false));
    });
  return Promise.all([probe("127.0.0.1"), probe("::1")]).then(([a, b]) => a || b);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(await freePort());
}
