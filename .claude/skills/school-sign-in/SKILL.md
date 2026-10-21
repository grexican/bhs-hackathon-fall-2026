---
name: school-sign-in
description: Add the school sign-in (the incubator hub's "Sign in with…" button, standard OpenID Connect) to ANY app, including one hosted somewhere else or built in another stack - Node (Express or Hono), Next.js (Auth.js) or Python (Flask with Authlib). Three settings, copy-paste code, how to read the user (sub, email, name, domain), logging out, and why you store people by `sub`. About 15 minutes. Use when someone wants "log in with my school account" in an app that isn't the kit's starter app, an app hosted outside the incubator, a Next.js or Python app, or asks how the sign-in works under the hood.
---

# School sign-in for any app

The hub is a standard **OpenID Connect** provider, so ready-made login libraries do the hard part.
In the kit's starter app you don't need this: `LOCKER_GATE=1` (every page) or `LOCKER_GATE=lazy` (a public
app where only the pages you pick need sign-in) turns it on with no login code (see `/ship` and
`locker/gate.mjs`). This skill is for every other app.

## 1. The three settings

| Setting | Where it comes from |
|---|---|
| `LOCKER_URL` (the issuer) | The hub's address, `https://locker.bhslabs.org` |
| `LOCKER_APP_ID` (client id) | Your app's registration on the hub |
| `LOCKER_APP_SECRET` (client secret) | Same. **Server only**, never in the browser or git |

- **App hosted by the incubator:** `/connect` already put all three in `apps/<codename>/.env`.
- **App hosted elsewhere:** an organizer registers it on the hub (its name, its `https://` address and
  the owner's school email). Then, from the kit: `mkdir apps/<codename>` and
  `npm run locker:join -- <codename>`; copy the three values from `apps/<codename>/.env` into your app's
  own environment settings.

**Callback address (redirect URI):** must be on the address the app was registered with (`https://`),
or `http://localhost:<port>/…` while you build on your laptop. Anything else is refused.

Everything a library needs is in the discovery document: `<LOCKER_URL>/.well-known/openid-configuration`
(code flow, PKCE `S256`, `client_secret_basic`, RS256 id_tokens, a `/oauth/userinfo` endpoint).

## 2. What you get back

| Claim | What it is |
|---|---|
| `sub` | The person's id **in your app**. Different in every app, so apps can't link people. Store users by this. |
| `email`, `email_verified` | Their school email (verified) |
| `name` | Their name (can be empty) |
| `domain` | The email's domain, handy for "school accounts only" checks |

Ask for scope `openid email profile`.

## 3. Copy-paste setups

### Node with Express (or Hono): `openid-client`

`npm install openid-client express express-session`

```js
import express from "express";
import session from "express-session";
import * as oidc from "openid-client";

const config = await oidc.discovery(new URL(process.env.LOCKER_URL), process.env.LOCKER_APP_ID, process.env.LOCKER_APP_SECRET);
const REDIRECT = `${process.env.APP_URL ?? "http://localhost:3000"}/auth/callback`;
const app = express();
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: "lax" } }));

app.get("/login", async (req, res) => {
  const verifier = oidc.randomPKCECodeVerifier();
  req.session.oidc = { verifier, nonce: oidc.randomNonce(), state: oidc.randomState() };
  res.redirect(oidc.buildAuthorizationUrl(config, {
    redirect_uri: REDIRECT, scope: "openid email profile",
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: "S256",
    nonce: req.session.oidc.nonce, state: req.session.oidc.state,
  }).href);
});

app.get("/auth/callback", async (req, res) => {
  const { verifier, nonce, state } = req.session.oidc ?? {};
  const tokens = await oidc.authorizationCodeGrant(config, new URL(req.originalUrl, REDIRECT), { pkceCodeVerifier: verifier, expectedNonce: nonce, expectedState: state });
  const { sub, email, name, domain } = tokens.claims();
  req.session.user = { sub, email, name, domain };   // keep users in your DB by `sub`
  res.redirect("/");
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/")));
```

Hono: the same `openid-client` calls in `app.get("/login")` and `app.get("/auth/callback")`, with
`c.req.url` as the callback URL and a signed cookie (`hono/cookie`) instead of `express-session`.
`SESSION_SECRET` is any long random string in `.env`.

### Next.js: Auth.js (`next-auth` v5)

`npm install next-auth@beta`, then `auth.ts`:

```ts
import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [{
    id: "school", name: "School account", type: "oidc",
    issuer: process.env.LOCKER_URL,
    clientId: process.env.LOCKER_APP_ID,
    clientSecret: process.env.LOCKER_APP_SECRET,
    checks: ["pkce", "state", "nonce"],
    authorization: { params: { scope: "openid email profile" } },
  }],
  callbacks: {
    jwt({ token, profile }) { if (profile) Object.assign(token, { sub: profile.sub, domain: profile.domain }); return token; },
    session({ session, token }) { session.user.id = token.sub!; return session; },
  },
});
```

`app/api/auth/[...nextauth]/route.ts`: `export const { GET, POST } = handlers;` Set `AUTH_SECRET` (any long
random string). The callback is `/api/auth/callback/school` on your app's address. Sign in with
`signIn("school")`, out with `signOut()`, read the user with `await auth()`.

### Python: Flask with Authlib

`pip install authlib flask requests`

```python
import os
from flask import Flask, redirect, session, url_for
from authlib.integrations.flask_client import OAuth

app = Flask(__name__)
app.secret_key = os.environ["SESSION_SECRET"]
oauth = OAuth(app)
oauth.register(
    "school",
    server_metadata_url=f"{os.environ['LOCKER_URL']}/.well-known/openid-configuration",
    client_id=os.environ["LOCKER_APP_ID"],
    client_secret=os.environ["LOCKER_APP_SECRET"],
    client_kwargs={"scope": "openid email profile", "code_challenge_method": "S256"},
)

@app.route("/login")
def login():
    return oauth.school.authorize_redirect(url_for("callback", _external=True))

@app.route("/auth/callback")
def callback():
    token = oauth.school.authorize_access_token()
    info = token["userinfo"]          # sub, email, name, domain
    session["user"] = {k: info.get(k) for k in ("sub", "email", "name", "domain")}
    return redirect("/")

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")
```

## 4. Rules

- **Store people by `sub`**, not email (emails can change; `sub` is stable for your app).
- **Logging out** clears your app's session. The person stays signed in on the hub (that's normal: the
  next "Sign in" is one click).
- **Who can sign in** is the app's audience on the hub: "school" lets in only school accounts; "everyone"
  also lets in parents and guests (Google or email + password). So with "everyone", don't assume a
  student: check `domain` on your server when something is for school accounts only.
- **The secret stays on the server.** If it leaks, ask an organizer for a new one.
- Each person only sees their own data: filter queries by the session's `sub` (`ai-safety` section 4).

## Done means

Signing in works on your laptop (`http://localhost`) and on the live address, the app shows the
person's name, a second account sees none of the first one's data, and logging out works.
