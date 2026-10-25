# Camera: take a photo in the app

Two ways. Pick by device.

## On a phone: use the phone's own camera app

```html
<input type="file" accept="image/*" capture="environment" hidden id="cam">
<button onclick="document.getElementById('cam').click()">Take a photo</button>
```

The phone opens its real camera (zoom, focus, flash all work) and gives you the picture. No permission
prompt, no video code. `capture="user"` opens the front camera. Leave `capture` out to let people pick
from their photos too.

## On a laptop: a live preview with `getUserMedia`

Ask for the camera **only from a tap** (Chrome and Safari ignore it otherwise), and only on `https` or
`localhost`.

**The trap:** asking for a specific camera ("the back one, 1280×1600") can fail on laptop webcams with
`NotFoundError`, *before Chrome ever shows its prompt*. It looks like "no camera" while the webcam is
fine. Always fall back to "any camera":

```js
async function openCamera(facing = "environment") {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1600 } },
    });
  } catch (err) {
    if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
      return navigator.mediaDevices.getUserMedia({ audio: false, video: true }); // any camera
    }
    throw err;
  }
}
```

Then put the stream in a `<video autoplay playsinline muted>` and draw a frame to a canvas to take the
picture. Stop the tracks when you're done (`stream.getTracks().forEach((t) => t.stop())`), or the
camera light stays on.

## Tell people what went wrong (by `err.name`)

| `err.name` | What it means | What to show |
|---|---|---|
| `NotAllowedError` | They (or the site settings) said no | "Allow Camera: click the icon in the address bar. On Windows also check Settings → Privacy → Camera." |
| `NotReadableError` | Another app has the camera | "Close Teams, Zoom or the Camera app, then try again." |
| `NotFoundError` (after the fallback) | Really no camera | Open the file picker instead. |

Log the name (`console.warn("[camera]", err.name, err.message)`): without it, every failure looks the same.

Always keep a "Choose from library" button next to the camera. Some people will never allow it.
