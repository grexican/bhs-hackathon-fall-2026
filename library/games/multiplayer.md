# Multiplayer: start on one device

Read only when the idea really needs two or more players. Online multiplayer is the most common
way a hackathon game runs out of time. Pick the smallest kind that still makes the idea work.

## The three sizes, smallest first

| Kind | Effort | Good for |
|---|---|---|
| **Same device**: two players, one keyboard (WASD vs arrows), or two gamepads, or split touch zones | an hour | party games, versus, co-op |
| **Turn-based online**: players take turns; the server stores the game | an afternoon | card games, puzzles, "beat my score" challenges |
| **Real-time online**: everyone moves at once over websockets | a day or more | only when "live together" IS the idea |

Same-device is real multiplayer, and it demos best: two people laughing at one laptop.
"Asynchronous" multiplayer is often enough too: race a ghost of a friend's best run (record the
inputs per step with the seed, replay them), or share a seed and compare scores.

## Same device

The input code from `game-loop-and-input.md` works per player: give each player a key map
(`{ left: "KeyA", right: "KeyD", action: "KeyW" }` vs the arrows) and one gamepad index
(`navigator.getGamepads()[i]`). On a phone or tablet, split the screen into halves and route each
`pointerdown` by which half it's in (each pointer has its own `pointerId`).

## Turn-based online

The app's own server already exists in the kit's starter (`server.js` + `node:sqlite`). A game is
a row; a move is a POST; the other player polls every 2 seconds or gets a push
(`push-notifications`). The server checks every move is legal. Never trust the browser.

## Real-time online, if you must

- **The server is the referee.** Clients send **inputs** ("left is held"), not positions. The
  server runs the game and sends back the state 10-20 times a second. Otherwise anyone can cheat
  with DevTools.
- **Smooth the gaps.** Draw other players slightly in the past, blending between the last two
  states the server sent (interpolation). Move your own player at once and correct it if the
  server disagrees.
- **Rooms with a short code** ("join ABCD") beat matchmaking for a demo.
- Websocket setup and the port wiring: `stack-picker` → websockets. Test with two browser windows
  and one phone, and on the deployed app, not only on the laptop.

## Pitfalls

- Starting online before the game is fun with one player.
- Sending positions from the client: cheating and desync.
- Testing only on one laptop with zero lag. Throttle the network in DevTools.
- A demo that needs a second person online at the right moment: have a same-device or bot mode ready.

---

Sources: written for this kit.
