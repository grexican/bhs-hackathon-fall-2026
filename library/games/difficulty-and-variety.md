# Difficulty curves, waves, seeds and variety

Read when the game plays but it's too easy, too hard, or every run feels the same. Also before
adding "random" anything: random without a seed can't be tested or shared.

## The curve: rising, in a sawtooth

Difficulty should rise overall, with short drops for rest. A flat high line exhausts players; a
flat low line bores them. A wave game makes this easy:

```text
intensity
  ^            /|        /|
  |      /|   / |   /|  / |  boss
  | /|  / |  /  |  / | /  |
  |/ |_/  |_/   |_/  |/   |
  +------------------------------> time
   w1  rest w2 rest w3 ...       each peak higher than the last
```

- **First 20 seconds: you can't lose.** Teach the controls with one slow enemy.
- **Each wave adds one thing:** more enemies, OR a new type, OR faster spawns. Not all three.
- **A rest between waves** (3-5 s): a pickup, a shop, a breather. Rest before the hardest wave.
- **Ramp the numbers smoothly:** `count = Math.round(3 + wave * 1.5)`,
  `speed = base * (1 + 0.05 * wave)`, with a cap so the late game is hard but possible.

## Waves as data

Put the curve in one table so it can be read, tuned and tested without touching the code:

```js
const WAVES = [
  { swarmer: 3,                         rest: 4 },   // teach: one kind, slow
  { swarmer: 6,                         rest: 4 },
  { swarmer: 4, brute: 1,               rest: 5 },   // new type, alone first
  { swarmer: 8, brute: 2,               rest: 5 },
  { swarmer: 6, shooter: 2,             rest: 6 },
  { swarmer: 10, brute: 2, shooter: 3,  rest: 6 },   // rest before the boss
  { boss: 1, swarmer: 4 },
];
// After the table ends: repeat the last 3 waves with +15% speed and +1 of each, forever (endless mode).
```

Spawn the enemies of a wave spread over a few seconds, not all at once, and never on top of the
player (pick a spawn point at least 150 px away, or off-screen with an arrow at the edge).

## Seeds: random, but repeatable

`Math.random()` can't be replayed. A seeded random number generator gives the same "random" run
for the same seed. Then a bug can be reproduced, a bot test compares runs fairly, and players can
share "try seed 4417".

```js
// mulberry32: tiny, fast, good enough for games. Same seed, same sequence.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedParam = new URLSearchParams(location.search).get("seed");
const seed = seedParam ? hash(seedParam) : (Math.random() * 2 ** 32) >>> 0;
const rand = rng(seed);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
```

Use `rand()` for everything that shapes the run (spawns, layout, loot). `Math.random()` is fine for
pure decoration (particle angles). Show the seed on the game-over screen.

## Variety per run (procedural, the hackathon-sized version)

Pick one or two; each adds a reason to replay:

- **Shuffled spawn points and enemy mixes** from the seed (cheapest, big effect).
- **Pick 1 of 3 upgrades** between waves. Upgrades change *how you play* (bullets pierce, a dash,
  a bigger magnet), not only `+10% damage`.
- **Rooms from pieces:** hand-make 6-10 small rooms, then chain them in a seeded order. Hand-made
  pieces give quality; the seed gives variety. Check every chain can be finished.
- **A random modifier per run:** "low gravity", "enemies are faster but have 1 HP", "darkness".
- **Grid caves:** fill a grid randomly (45% walls), then 4 smoothing passes where a tile becomes
  wall if 5 or more of its 8 neighbors are walls. Then flood-fill from the start and fill in
  everything it can't reach, so there are no closed pockets.

## Is the difficulty right? Measure it

Feelings lie, especially the builder's (you know the game too well). Measure:

- **Bot survival time** across 10 seeds (`playtest-with-a-bot.md`): a bot that does nothing
  should die in the first minute; a simple dodging bot should reach wave 4-6.
- **Where real players die:** log the wave and cause of each death, then look at the pile.
- **Fair-death check:** for each death, was there a telegraph? If not, fix the telegraph, not the numbers.

**Adaptive difficulty** (optional): after 2 quick deaths in a row, quietly lower spawn speed by
10% for the next run. Never make it visible, and never punish a player for doing well.

## Pitfalls

- The builder tunes the game for themselves. It ends up too hard for everyone else.
- Difficulty only from bigger numbers (HP sponges). Add new behaviors instead (`enemy-ai.md`).
- Random spawns on top of the player: an unfair death in the first second.
- No seed: "it crashed on wave 7 once" can never be reproduced.

---

Sources: pacing ideas from the level-design discipline in [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) (Apache-2.0); seeded RNG is mulberry32 (public domain); the rest written for this kit.
