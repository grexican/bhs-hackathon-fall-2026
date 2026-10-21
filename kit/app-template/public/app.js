// The page's code: asks the server for data and updates the screen.
const countEl = document.querySelector("#count");
const button = document.querySelector("#tap");

// Load the current count when the page opens.
const res = await fetch("/api/taps");
countEl.textContent = (await res.json()).count;

// Who's using it? Only known when the sign-in gate is on and they signed in (LOCKER_GATE, see server.js).
const { user } = await (await fetch("/api/me")).json();
if (user) document.querySelector("#hello").textContent = `Hi, ${user.name ?? user.email}!`;

// Save a tap, then show the new total the server sends back.
button.addEventListener("click", async () => {
  const saved = await fetch("/api/taps", { method: "POST" });
  countEl.textContent = (await saved.json()).count;
});
