// The "Ask the AI" box: a working AI example. It adds a small form under the page's content and
// sends the question to the server (POST /api/ask), which calls the AI with the app's own key.
// Turn it on in index.html. Build your own AI feature the same way: the page asks YOUR server, never the AI directly.
const main = document.querySelector("main");
const box = document.createElement("form");
box.className = "ask";
box.innerHTML = `
  <label for="question">Ask the AI anything</label>
  <div class="ask-row"><input id="question" name="question" maxlength="500" autocomplete="off" placeholder="What should I eat for lunch?"><button>Ask</button></div>
  <p class="ask-answer" role="status"></p>`;
main.append(box);

const answer = box.querySelector(".ask-answer");
box.addEventListener("submit", async (event) => {
  event.preventDefault();
  answer.textContent = "Thinking…";
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: box.question.value }),
  });
  const json = await res.json();
  // Errors (like "the AI budget is used up") come back as { error }: show them, don't break.
  answer.textContent = json.error ?? (json.note ? `${json.answer} (${json.note})` : json.answer);
});
