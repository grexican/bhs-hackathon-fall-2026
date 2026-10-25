// The push service worker: the tiny script the browser keeps running in the background, so a
// notification can arrive while the app is closed. locker/push.mjs serves it at /push-sw.js.
// It only shows notifications. It has no "fetch" handler, so it never caches your pages: changes you
// deploy show up as usual.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// A message from the hub: { title, body, url, tag, icon }. Always show something (iPhones turn
// notifications off for an app that receives one and shows nothing).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "New notification", {
      body: data.body || "",
      icon: data.icon || undefined,
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    }),
  );
});

// Tapping it: go to its page in a tab that's already open, or open one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  if (target.origin !== self.location.origin) target.href = self.location.origin + "/"; // only this app's pages
  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = tabs.find((t) => t.url === target.href) ?? tabs.find((t) => new URL(t.url).origin === target.origin);
      if (same) {
        await same.focus();
        if (same.url !== target.href && "navigate" in same) await same.navigate(target.href).catch(() => {});
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
