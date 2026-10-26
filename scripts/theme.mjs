#!/usr/bin/env node
// Theme presets: a palette, a font pairing, a type scale and a spacing scale, as CSS variables.
// Every starter app begins on one, so nothing ever starts gray. The presets live in kit/themes/*.css.
//   npm run theme                          list the presets (name, mood, fonts)
//   npm run theme -- <preset> <codename>   switch apps/<codename>/ to that preset
// The app gets its own copy (src/theme.css, or public/theme.css in the plain starter): change it freely.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = process.env.LOCKER_KIT_ROOT ?? KIT;
const THEMES = path.join(KIT, "kit", "themes");

/** One preset: its name, mood, light/dark, fonts and the CSS itself (headers come from the file's top comment). */
export function readTheme(name) {
  const file = path.join(THEMES, `${name}.css`);
  if (!fs.existsSync(file)) throw new Error(`No theme called "${name}". Themes: ${listThemes().map((t) => t.name).join(", ")}`);
  const css = fs.readFileSync(file, "utf8");
  const field = (key) => css.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, "m"))?.[1].trim() ?? "";
  return { name, mood: field("mood"), scheme: field("scheme") === "light" ? "light" : "dark", fonts: field("fonts"), fontsHref: field("fonts-href"), css, background: css.match(/--background:\s*([^;]+);/)?.[1].trim() ?? "#000" };
}

export function listThemes() {
  return fs.readdirSync(THEMES).filter((f) => f.endsWith(".css")).sort().map((f) => readTheme(f.replace(/\.css$/, "")));
}

/** Writes the preset into an app folder and points its page at the preset's fonts and light/dark mode. */
export function applyTheme(dir, name) {
  const theme = readTheme(name);
  const hasSrc = fs.existsSync(path.join(dir, "src"));
  const target = path.join(dir, hasSrc ? "src" : "public", "theme.css");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, theme.css);
  const html = [path.join(dir, "index.html"), path.join(dir, "public", "index.html")].find((f) => fs.existsSync(f));
  if (html) {
    const text = fs
      .readFileSync(html, "utf8")
      .replace(/<link rel="stylesheet" href="[^"]*" data-theme-fonts>/, `<link rel="stylesheet" href="${theme.fontsHref}" data-theme-fonts>`)
      .replace(/<html[^>]*>/, `<html lang="en"${theme.scheme === "dark" ? ' class="dark"' : ""}>`)
      .replace(/<meta name="theme-color" content="[^"]*"/, `<meta name="theme-color" content="${theme.background}"`);
    fs.writeFileSync(html, text);
  }
  return { theme, file: path.relative(dir, target) };
}

function main() {
  const [preset, codename] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!preset) {
    console.log("Theme presets (kit/themes/). Switch with: npm run theme -- <preset> <codename>\n");
    for (const t of listThemes()) console.log(`${t.name.padEnd(15)} ${t.scheme.padEnd(6)} ${t.fonts}\n${"".padEnd(23)}${t.mood}`);
    return;
  }
  if (!codename) return fail("Usage: npm run theme -- <preset> <codename>");
  const dir = path.join(ROOT, "apps", codename);
  if (!fs.existsSync(dir)) return fail(`apps/${codename}/ doesn't exist.`);
  try {
    const { theme, file } = applyTheme(dir, preset);
    console.log(`apps/${codename}/${file} is now "${theme.name}" (${theme.fonts}). Reload the page to see it.`);
  } catch (err) {
    fail(err.message);
  }
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
}

if (process.argv[1]?.endsWith("theme.mjs")) main();
