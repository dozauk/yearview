# YearView

A self-hosted web app that displays your entire Google Calendar year in a single view. Connect your Google account and see all your events laid out across 12 months — with two view modes, per-calendar filtering, and direct links into the Google Calendar editor.

Live at [yearview.doza.tech](https://yearview.doza.tech)

---

## Features

- **Timeline view** — 12 horizontal month rows, days as columns. Align by weekday (all Mondays line up vertically) or by date (strict 1–31 grid)
- **Grid view** — classic 3-column × 4-row year calendar
- **Gantt-style event bars** — multi-day events span across their full date range as a single bar
- **Per-calendar toggles** — collapsible sidebar with colour-coded checkboxes; filtering is instant (no refetch)
- **Event colour control** — choose whether bar colour comes from the event or the calendar; optional secondary colour chip
- **Click a day** — popover shows all events for that day plus a "+ New event" link
- **Double-click an event** — opens the event editor in a popup window
- **Year navigation** — step forward/backward through years
- **Persistent sessions** — stay logged in across server restarts (SQLite-backed sessions)
- **Silent token refresh** — Google access tokens refresh automatically in the background

---

## Architecture

```
Browser
  └── public/
        ├── index.html          Landing page / OAuth entry point
        ├── calendar.html       Main app shell
        ├── css/style.css       All styles
        └── js/
              ├── app.js        State, sidebar, controls, popover, event wiring
              ├── api.js        Fetch wrappers (GET /api/calendars, /api/events)
              ├── timeline.js   View A renderer (12 flat month rows + overlay lanes)
              ├── grid.js       View B renderer (3×4 month grid)
              └── util.js       Date helpers, colour resolution, popup openers

Node.js / Express  (server.js)
  ├── GET  /                    Redirect to /calendar.html if authenticated
  ├── GET  /auth/login          Generate Google OAuth URL, redirect
  ├── GET  /auth/callback       Exchange code for tokens, store in session
  ├── GET  /auth/logout         Destroy session
  ├── GET  /auth/status         { authenticated: bool }
  ├── GET  /api/calendars       Proxy → Google calendarList.list
  └── GET  /api/events?year=N   Proxy → Google events.list (all calendars, paginated)

SQLite  (sessions.db)
  └── sessions table            express-session store via better-sqlite3-session-store
```

### Key design decisions

**No build step.** The frontend is plain HTML + CSS + ES modules. No bundler, no transpiler, no framework. The browser loads the files directly.

**Server-side OAuth only.** Google credentials never touch the browser. The Express server handles the full OAuth flow and proxies all Calendar API calls. The client only talks to `/api/*` on its own origin.

**Lane-based event rendering.** Multi-day events are rendered as CSS grid-spanning elements in an absolutely-positioned overlay layer, not duplicated per cell. A greedy lane-assignment algorithm stacks overlapping events without collision (up to 3 visible lanes, then "+N more").

**Client-side calendar filtering.** All events for the year are fetched once on load. Toggling a calendar on/off re-renders from the in-memory event list with no additional API call.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML / CSS / JS (ES modules) |
| Backend | Node.js 22, Express 4 |
| Auth | Google OAuth 2.0 (`googleapis` library) |
| Sessions | `express-session` + `better-sqlite3-session-store` |
| Hosting | Docker on Synology NAS |
| Ingress | Cloudflare Tunnel (no port forwarding) |
| CI | GitHub Actions → ghcr.io |

---

## Local development

**Prerequisites:** Node.js 22+, a Google Cloud project with the Calendar API enabled.

**1. Clone and install**
```bash
git clone https://github.com/dozauk/yearview.git
cd yearview
npm install
```

**2. Configure**
```bash
cp .env.example .env
# Edit .env — fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET
```

**3. Google Cloud setup**
- Enable the **Google Calendar API**
- Create an **OAuth 2.0 client** (Web application)
- Add `http://localhost:3000/auth/callback` to Authorized redirect URIs
- Add yourself as a test user under the OAuth consent screen

**4. Run**
```bash
npm run dev      # auto-restarts on file changes
```

Open [http://localhost:3000](http://localhost:3000).

---

## Self-hosted deployment (Synology NAS)

### One-time setup

```bash
# SSH into the NAS, then:
curl -o setup.sh https://raw.githubusercontent.com/dozauk/yearview/master/synology-setup.sh
bash setup.sh
```

The script clones the repo to `/volume1/docker/yearview`, prompts for credentials, and starts the containers.

### Updating to latest

```bash
bash /volume1/docker/yearview/synology-setup.sh
```

Pulls the latest image from `ghcr.io/dozauk/yearview:latest` and restarts.

### Infrastructure

```
Internet
  └── Cloudflare (yearview.doza.tech, TLS termination)
        └── Cloudflare Tunnel
              └── Synology NAS (Docker)
                    ├── yearview container   (Node.js app, port 3000 internal)
                    └── cloudflared container (tunnel agent)
```

The `yearview` container's port 3000 is **not exposed to the host** — all traffic flows through the Cloudflare tunnel. The `cloudflared` container dials outbound to Cloudflare; no inbound firewall rules or port forwarding needed.

### Environment variables

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL (hardcoded in `docker-compose.yml` for production) |
| `SESSION_SECRET` | Long random string for signing session cookies |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token from Cloudflare Zero Trust → Tunnels |
| `DB_PATH` | Path to `sessions.db` (default: project root; Docker sets `/data/sessions.db`) |
| `PORT` | HTTP port (default: `3000`) |

### CI/CD

Every push to `master` triggers a GitHub Actions workflow that builds the Docker image and pushes it to `ghcr.io/dozauk/yearview:latest` (tagged with both `latest` and the commit SHA). The Synology pulls this pre-built image — no build step on the NAS.

---

## Google OAuth notes

The app requests the `calendar.readonly` scope — it can read events but cannot create, edit, or delete them. (Creating/editing events opens Google Calendar directly in a popup window.)

While the OAuth consent screen is in **Testing** status, only explicitly listed test users can sign in (up to 100). To open the app to any Google account, submit for Google's OAuth verification.
