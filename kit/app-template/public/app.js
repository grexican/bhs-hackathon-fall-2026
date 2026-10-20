// The page's code: asks the server for data and updates the screen.
const countEl = document.querySelector("#count");
const button = document.querySelector("#tap");

// Load the current count when the page opens.
const res = await fetch("/api/taps");
countEl.textContent = (await res.json()).count;

// Save a tap, then show the new total the server sends back.
button.addEventListener("click", async () => {
  const saved = await fetch("/api/taps", { method: "POST" });
  countEl.textContent = (await saved.json()).count;
});
