---
name: maps
description: Put a real, interactive map in the student's app with no account and no API key - Leaflet with OpenStreetMap tiles, pins from the app's own database, "near me" with the phone's location, and distance sorting. Covers the rules that keep it free (attribution, light use), location permission on phones (needs https), and a simulated location for testing. Use when an idea has places in it - "near me", "where is", a map of spots, lost and found, routes, events around school - or a student asks for Google Maps.
---

# Maps without a key

Most "near me" ideas stall on a map API that wants a credit card. They don't need one.
**Leaflet** (a small map library) with **OpenStreetMap** tiles is free, needs no account, and works
on phones. Say that to the student in one line, then build the smallest map first: one pin.

## 1. The map

Install `leaflet` (or load it from a CDN for a plain HTML app). Then:

```js
// A map centred on the place the app is about, with the attribution OpenStreetMap requires.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
const map = L.map("map").setView([41.39, 2.17], 15); // lat, lng, zoom (15 = a neighbourhood)
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);
```

The map's box needs a height in CSS (`#map { height: 60dvh; }`), or it shows nothing. That's the
number one "my map is blank" bug. Ask the student where the map should start; use that, not a guess.

**Keep it free:** never remove the attribution, don't preload or download tiles in bulk, and keep
it to normal use. A school app is fine. If the app ever gets big, that's a good problem: switch tile
providers then.

## 2. Pins from the app's data

Places are rows in the app's SQLite (`places(id, name, lat, lng, note, created_at)`), with seed
data so the map is never empty on first boot. The server sends them as JSON; the page adds
`L.marker([lat, lng]).bindPopup(name)` for each. Adding a place = tap the map
(`map.on("click", e => …e.latlng)`), type a name, save. Escape the names before they go into a
popup (they're user input).

## 3. "Near me"

`navigator.geolocation.getCurrentPosition(ok, fail)` asks the phone for its location.

- It only works on **https** (the live app after `/ship`) or `localhost`. On a phone over the
  laptop's Wi-Fi address it silently fails. Test it on the live address.
- Ask only when the user taps a "near me" button, never on page load. Explain why first ("to show
  spots near you"). If they say no, the app still works: show the default area.
- Sort by distance with the haversine formula (a few lines; no library needed).
- **Simulated location** for testing: a `?at=41.39,2.17` query parameter (or a dev panel) that
  overrides the real one, labelled "Simulated location".

## 4. Privacy

A person's location is personal. Don't save it unless the feature truly needs it, never show one
person's live location to others without a clear opt-in, and round saved spots to places, not
people (the café, not the user). For apps for younger students, ask an organizer before sharing
any location between users.

## Done means

The map shows seeded pins on first boot, a new pin survives a restart, "near me" works on the live
address on a real phone (`/on-my-phone`), and saying no to location still leaves a working app.
Check with `verify-in-browser`.
