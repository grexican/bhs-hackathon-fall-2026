# Audio and music for browser games

Read when the game needs sound effects or music. Sound is half of game feel, and the Web Audio API
can make all of it in code: no sound files, no downloads, no licenses to check.

## Rule zero: audio starts on a tap

Browsers block sound until the player interacts. Create (or resume) the audio context on the first
tap or key, usually the Play button:

```js
let ac = null, master, sfxBus, musicBus;
function startAudio() {
  if (!ac) {
    ac = new AudioContext();
    master = ac.createGain(); master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.35; musicBus.connect(master);  // music under SFX
  }
  ac.resume();
}
playButton.addEventListener("click", startAudio);
```

Also suspend on `visibilitychange` (`ac.suspend()` when hidden), so sound stops with the game.
On iPhone, the ring/silent switch mutes Web Audio. That's normal; say "turn your sound on" in the hint.

## Sound effects from a synth

A tiny synth covers most retro SFX. Every sound gets a **small random pitch and volume spread**,
so the 50th coin doesn't sound like a machine.

```js
function tone({ type = "square", from = 440, to = from, dur = 0.12, vol = 0.3, spread = 0.06 }) {
  if (!ac) return;
  const t = ac.currentTime, jitter = 1 + (Math.random() * 2 - 1) * spread;
  const osc = ac.createOscillator(), env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from * jitter, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to * jitter), t + dur);
  env.gain.setValueAtTime(vol * (0.9 + Math.random() * 0.2), t);
  env.gain.exponentialRampToValueAtTime(0.001, t + dur);   // short envelope: a click, not a drone
  osc.connect(env).connect(sfxBus);
  osc.start(t); osc.stop(t + dur);
}

const SFX = {
  coin:  () => tone({ from: 880, to: 1760, dur: 0.1, type: "triangle" }),
  jump:  () => tone({ from: 300, to: 600, dur: 0.15 }),
  hit:   () => tone({ from: 200, to: 60, dur: 0.12, type: "sawtooth" }),
  hurt:  () => tone({ from: 150, to: 40, dur: 0.3, type: "sawtooth", vol: 0.4 }),
};
```

For explosions and hits, short **noise** works better than a tone: fill an `AudioBuffer` with
`Math.random() * 2 - 1`, play it through a low-pass `BiquadFilterNode` whose frequency drops fast.

**Combos:** raise pitch along a scale for each hit in a chain (`from: 440 * 2 ** (step / 12)` with
steps 0, 2, 4, 7, 9, 12). It sounds musical instead of random.

## Ducking: let the important sound through

When something big happens (the player is hurt, a boss appears), drop the music for a moment:

```js
function duck(amount = 0.3, time = 0.4) {
  const g = musicBus.gain, t = ac.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(0.35 * amount, t + 0.03);
  g.linearRampToValueAtTime(0.35, t + time);
}
```

Also cap how many copies of one sound can play at once (3-4). Ten coin sounds in the same
frame are just noise.

## Music: a loop that fits the game

- **One short loop** (8-16 bars) is enough for a hackathon game. Make it in code with the same
  `tone` approach, scheduled ahead on `ac.currentTime`, or use a track the student made or has
  the rights to.
- **Build a melody from the chord's notes** on the strong beats, with in-key steps between them.
  Mostly small steps, few big jumps: random jumping between notes sounds like noise.
- **End the loop where it can start again.** The last bar should calm down and land on the home
  chord (for a minor key, i; the classic way home is V → i), and its energy should match the first bar.
  Then the seam is invisible. A dense peak that slams back into a quiet intro sounds broken.
- **Layers follow the game.** Pad alone on the title screen; add bass when the wave starts; add
  drums when enemies are close; drop to pad between waves. Fade layers in and out over 0.5-1 s, never cut.
- **Different moods, different grooves:** changing tempo, swing and the lead sound does more than
  changing the notes. Minor + slow = tense; major + fast = arcade; Dorian (minor with a bright 6th) = adventurous.

## Accessibility (a hard rule)

**Never tell the player something only with sound.** Every important sound (hurt, an enemy
off-screen, a timer) also has a visual: a flash, an edge arrow, a shake. Many people play muted,
especially on phones in class. Avoid sudden very loud sounds, and keep a mute button on the title
and pause screens.

## Pitfalls

- Making a new `AudioContext` per sound. Make one, reuse it.
- Sound before the first tap: it silently fails.
- Music as loud as the SFX: the important sounds get lost.
- A loop with a click at the seam: fade the last few milliseconds, or end the last note before the loop point.

---

Sources: ideas from the audio pipeline in [Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) and standard music theory; code written for this kit.
