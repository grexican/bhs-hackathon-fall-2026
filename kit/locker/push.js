// "Turn on notifications" for any page. It asks the browser for permission ONLY when the person taps,
// then sends this device's subscription to YOUR server (locker/push.mjs), which passes it to the hub.
//
// No code: <button type="button" data-push-button>Turn on notifications</button>
//          <script src="/locker/push.js" defer></script>
// The button then shows the right thing: "Turn on", "Send a test", "Add to Home Screen first" (iPhone),
// "blocked" or "not supported", with a short line under it.
//
// With code: window.lockerPush
//   await lockerPush.status()  → "on" | "off" | "denied" | "unsupported" | "ios-home-screen"
//   await lockerPush.turnOn()  → { user } (call it from a tap/click handler, never on page load)
//   await lockerPush.turnOff()
//   await lockerPush.test()    → sends "It works!" to this person
//   lockerPush.deviceId        → this device's id ("device:…" on the server when nobody is signed in)
(() => {
  if (window.lockerPush) return;
  const KEY = "locker-push-device";
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  let deviceId = store.get(KEY);
  if (!deviceId) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    deviceId = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    store.set(KEY, deviceId);
  }

  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const installed = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  const post = async (url, body) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device: deviceId, ...body }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
    return json;
  };
  const b64ToBytes = (s) => {
    const raw = atob((s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  };

  // Started on page load (no permission needed), so the tap itself does as little waiting as possible.
  const ready = supported
    ? Promise.all([
        navigator.serviceWorker.register("/push-sw.js", { scope: "/" }).then(() => navigator.serviceWorker.ready),
        fetch("/api/push/key").then((r) => r.json()).catch(() => ({ simulated: true })),
      ])
    : null;
  ready?.catch((err) => console.warn("[push] couldn't get ready:", err));
  let simulatedOn = store.get(`${KEY}-sim`) === "1";

  async function status() {
    if (isIos && !installed) return "ios-home-screen";
    if (!supported) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    if (Notification.permission !== "granted") return "off";
    const [reg, key] = await ready;
    if (key.simulated) return simulatedOn ? "on" : "off";
    return (await reg.pushManager.getSubscription()) ? "on" : "off";
  }

  async function turnOn() {
    if (isIos && !installed) throw new Error("On iPhone, add this app to your Home Screen first: tap Share, then Add to Home Screen. Open it from there and tap this again.");
    if (!supported) throw new Error("This browser can't show notifications. Try Chrome, Edge, Firefox or Safari.");
    // Asked first, straight from the tap: some browsers only allow it then.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error(permission === "denied" ? "Notifications are blocked. Turn them on in the browser's settings for this site." : "No problem. Tap again whenever you want them.");
    const [reg, key] = await ready;
    if (key.simulated || !key.publicKey) {
      simulatedOn = true;
      store.set(`${KEY}-sim`, "1");
      return { ...(await post("/api/push/subscribe", {})), simulated: true };
    }
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key.publicKey) }));
    try {
      return await post("/api/push/subscribe", { subscription: sub.toJSON() });
    } catch (err) {
      await sub.unsubscribe().catch(() => {}); // the server didn't keep it: don't look "on" when it isn't
      throw err;
    }
  }

  async function turnOff() {
    simulatedOn = false;
    store.set(`${KEY}-sim`, "0");
    const reg = supported ? (await ready)[0] : null;
    const sub = await reg?.pushManager.getSubscription();
    await post("/api/push/unsubscribe", { endpoint: sub?.endpoint });
    await sub?.unsubscribe();
  }

  async function test() {
    const r = await post("/api/push/test", {});
    // Not connected to the hub: the page shows the notification itself, labelled, so you see what it looks like.
    if (r.simulated) {
      const [reg] = await ready;
      await reg.showNotification(`${r.message.title} (simulated)`, { body: r.message.body, tag: r.message.tag, data: { url: "/" } });
    }
    return r;
  }

  window.lockerPush = { status, turnOn, turnOff, test, deviceId: `device:${deviceId}` };

  // ---- the no-code button: <button data-push-button> ----
  const LABELS = {
    off: "Turn on notifications",
    on: "Send me a test notification",
    denied: "Notifications are blocked",
    unsupported: "Notifications don't work in this browser",
    "ios-home-screen": "Turn on notifications",
  };
  const HINTS = {
    denied: "Turn them on in the browser's settings for this site.",
    "ios-home-screen": "On iPhone: tap Share, then Add to Home Screen. Open the app from your Home Screen and tap this again.",
  };
  function wire(button) {
    if (button.dataset.pushWired) return;
    button.dataset.pushWired = "1";
    const line = document.createElement("p");
    line.setAttribute("role", "status");
    line.className = "push-status";
    line.style.cssText = "margin:.4em 0 0;font-size:.9em;opacity:.8";
    button.after(line);
    let current = "off"; // the last status painted: the tap uses it, so the permission prompt comes with no wait before it
    const paint = async (note) => {
      const s = (current = await status().catch(() => "unsupported"));
      button.textContent = LABELS[s];
      button.disabled = s === "denied" || s === "unsupported";
      line.textContent = note ?? HINTS[s] ?? "";
    };
    button.addEventListener("click", async () => {
      const s = current;
      try {
        if (s === "ios-home-screen") return paint(HINTS[s]);
        if (s === "on") {
          const r = await test();
          return paint(r.simulated ? "Simulated on this laptop (it's in the terminal too). After /connect it really sends." : r.sent ? "Sent! It should pop up in a moment." : "Sent, but no device got it. Turn them off and on again.");
        }
        const r = await turnOn();
        await paint(r.simulated ? "On (simulated until the app is connected)." : "Notifications are on.");
      } catch (err) {
        await paint(err.message);
      }
    });
    paint();
  }
  const wireAll = () => document.querySelectorAll("[data-push-button]").forEach(wire);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireAll);
  else wireAll();
})();
