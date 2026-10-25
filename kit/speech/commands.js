// Voice commands: turn what someone said into one of YOUR commands, or null.
//
//   matchCommand("eh, salta ya", ["salta", "dispara", "pausa"])   → { command: "salta", heard: "eh, salta ya" }
//   matchCommand("go left", { left: ["left", "go left", "izquierda"], right: ["right", "derecha"] })   → { command: "left", … }
//
// A list means each word or phrase is its own command. An object gives each command several ways to say it.
// Works with every engine. With the "vosk" engine the same list also limits what the recognizer can hear.

// Lowercase, no accents, no punctuation: "¡Sálta!" and "salta" are the same command.
export const normalize = (text) =>
  String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Every way to say every command, as [phrase, command] pairs, longest phrases first. */
export function commandPhrases(commands) {
  const pairs = Array.isArray(commands)
    ? commands.map((c) => [String(c), String(c)])
    : Object.entries(commands ?? {}).flatMap(([command, ways]) => [command, ...[].concat(ways)].map((w) => [String(w), command]));
  const seen = new Set();
  return pairs
    .filter(([phrase]) => phrase.trim() && !seen.has(normalize(phrase)) && seen.add(normalize(phrase)))
    .sort((a, b) => b[0].length - a[0].length);
}

// How many single-letter edits turn a into b (so "jum" still finds "jump").
function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

/** Which command was said? Exact phrase first, then the first one inside the sentence, then a close spelling. */
export function matchCommand(text, commands) {
  const heard = normalize(text);
  if (!heard) return null;
  const pairs = commandPhrases(commands).map(([phrase, command]) => [normalize(phrase), command]);
  const exact = pairs.find(([phrase]) => phrase === heard);
  if (exact) return { command: exact[1], heard: text };
  // Said inside a sentence: the first command said wins ("salta y dispara" → salta).
  const padded = ` ${heard} `;
  const inside = pairs
    .map(([phrase, command]) => ({ at: padded.indexOf(` ${phrase} `), command }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)[0];
  if (inside) return { command: inside.command, heard: text };
  // A near miss ("jum" for "jump"): allow about one wrong letter in four, never on very short words.
  let best = null;
  for (const [phrase, command] of pairs) {
    if (phrase.length < 4) continue;
    for (const piece of [heard, ...heard.split(" ")]) {
      const d = editDistance(piece, phrase);
      if (d <= Math.floor(phrase.length / 4) && (!best || d < best.d)) best = { d, command };
    }
  }
  return best ? { command: best.command, heard: text } : null;
}

/** The words the offline (vosk) recognizer may hear: your phrases plus "[unk]" for everything else. */
export function voskGrammar(commands) {
  return [...commandPhrases(commands).map(([phrase]) => phrase.toLowerCase().trim()), "[unk]"];
}
