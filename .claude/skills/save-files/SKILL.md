---
name: save-files
description: Let the student's app keep files - photos people upload, profile pictures, AI-generated images, PDFs - on the app's own disk (the /data volume next to the database), safely and within the app's small budget. Covers where files go locally vs online, size and type limits, random file names, serving them back, resizing images in the browser first, and caching AI images so each one is paid for once. Use when a feature needs file or photo upload, "attach a picture", "profile photo", saving generated images, or when uploads vanish after a deploy.
---

# Save files (uploads and AI images)

Every app online gets a disk at `/data` that survives deploys. The database lives there
(`DATABASE_PATH=/data/app.db`), and so can files. Anything saved anywhere else **disappears on the
next deploy**. That's the number one "my photos are gone" bug.

Explain the plan to the student in two lines before building, then build it the smallest way.

## Where files go

Use one folder, next to the database, worked out from `DATABASE_PATH`:

```js
// Files live next to the database: ./data/uploads on the laptop, /data/uploads online.
import path from "node:path";
import fs from "node:fs";
const DB = process.env.DATABASE_PATH ?? "./data/app.db";
export const UPLOADS = path.join(path.dirname(DB), "uploads");
fs.mkdirSync(UPLOADS, { recursive: true });
```

Save the **file** in that folder and a **row** in SQLite (`id, owner, kind, bytes, created_at`). The
row is what the app lists and deletes; the file is just the bytes. `data/` is already in `.gitignore`; check.

## The rules (all of them, every time)

1. **Size limit on the server**, not just the browser: 5 MB is plenty for a photo. Reject bigger with a clear message.
2. **Only the types you expect.** Images: check the first bytes really are PNG/JPEG/WebP/GIF, not just
   the file name. **Never** accept HTML or SVG uploads (they can run code in your app's page).
3. **Never use the uploaded file name.** Name it `<random id>.<ext>` (`crypto.randomUUID()`). Keep the
   original name in the database if you need to show it.
4. **Serve files through a route** (`GET /files/:id`) that looks the row up, sets the right
   `Content-Type`, and checks who may see it if the app has sign-in. Not from the public folder.
5. **Shrink images in the browser before uploading.** Phone photos are 3–8 MB. Draw them on a
   `<canvas>` at about 1280 px wide and upload `canvas.toBlob(..., "image/webp", 0.8)`. Uploads get
   10x faster and the disk lasts.
6. **The disk is small.** Show a count or a "delete" button; don't keep what nobody needs.

Read `security-review` (file uploads section) once the route works.

## AI-generated images

`image(prompt)` from `kit/ai` (`ai-kit`) returns a `dataUrl`. Images cost real money from the app's
monthly AI budget, so:

- **Pay once:** hash the prompt (`crypto.createHash("sha256")`), and if `uploads/ai-<hash>.png` exists,
  serve it instead of generating again.
- **Save the bytes**, not the data URL: `Buffer.from(dataUrl.split(",")[1], "base64")`.
- **Never generate in a loop** or on every page load. Generate on a button press, show a loading state,
  then save.
- In simulator mode (`simulated: true`) you get a labelled placeholder: save it the same way so the whole flow works offline.

## Done means

Upload a photo locally, restart the server, and it's still there. After `/ship`, upload one on the
live app, deploy again, and it's **still** there. A too-big file and a renamed `.html` file are both
rejected with a friendly message. Prove it with `verify-in-browser`.
