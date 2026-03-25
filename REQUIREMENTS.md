# YearView — Requirements

A simple web app that lets users connect their Google Calendar and see all events for the current year at a glance.

---

## Goals

- Show an entire year of calendar events in a single, scannable view
- Let users authenticate with Google Calendar via OAuth
- Keep the stack simple: plain HTML/CSS/JS or a minimal framework, no build step required
- Fast to load, fast to navigate

---

## Tech Stack

- **Frontend:** Vanilla HTML + CSS + JavaScript (ES modules, no bundler)
- **Backend / Auth:** Node.js with Express — handles the Google OAuth flow and proxies Calendar API calls so credentials stay server-side
- **No database required** — sessions are short-lived; no event storage
- **Deployment target:** any Node.js host (Railway, Fly.io, Render, VPS)

---

## Pages / Views

### 1. Landing page (`/`)
- Brief description of the app
- "Connect Google Calendar" button → starts OAuth flow

### 2. Year view (`/calendar`)

#### Layout
The page is divided into two areas:

- **Left: collapsible sidebar** — calendar list with toggles (see below)
- **Right: main view area** — the year grid (Timeline or Grid view)

When collapsed, the sidebar shrinks to a narrow icon strip so the grid can use full width.

Two view modes, toggled by buttons in the header. Both share the same header controls: `< 2026 >` year navigation, view toggle, and a refresh button.

#### View A — "Timeline" (default)
12 horizontal month rows, one per month, stacked vertically and filling the page:

- Each row is labelled with the month name on the left
- The row spans the full viewport width; days are evenly-spaced columns across it
- Day-of-week header (M T W T F S S) repeats above each row
- Weeks are not sub-grouped — days simply run left to right for the whole month
- Events render as **coloured horizontal bars** spanning their duration; multi-day events stretch across day columns like a Gantt chart
- Single-day events are a bar within that day's column
- Up to **3 event bars** visible per day cell; overflow shown as **"+N more"** link
- Clicking "+N more" or any event bar opens a small popover with the full event list for that day (title, time, calendar name)

#### View B — "Grid" (3 columns × 4 rows)
Classic year-at-a-glance calendar grid matching the screenshot (`example.png`):

- 12 month blocks arranged **3 wide × 4 tall**
- Each block is a mini-calendar: week rows (Mon–Sun), day number cells
- Events render as **coloured horizontal bars** inside day cells, same Gantt-style as View A
- Up to **3 event bars** per day cell; overflow shown as **"+N more"**
- Clicking "+N more" or an event bar opens the same day popover as View A

#### Sidebar — Calendar Toggles
- Lists all of the user's Google Calendars, each with:
  - A **coloured checkbox** (using the calendar's Google colour)
  - The calendar name
- Checking/unchecking a calendar instantly shows/hides its events in the view (no refetch — filter client-side)
- A **"Select all / Deselect all"** control at the top of the list
- Sidebar can be collapsed to a narrow strip (e.g. `<<` toggle button); expanded state persists via `localStorage`
- Calendar list is fetched once on page load alongside events

#### Shared behaviour (both views)
- Weeks start on **Monday**
- Events **colour-coded** by the colour set in Google Calendar (per-calendar colour)
- **Current day** cell is highlighted
- Clicking an event bar shows a popover: event title, date/time, calendar name
- Multi-day events that span a week boundary continue as a bar on the next row with a visual continuation marker (e.g. arrow or faded left edge)

### 3. OAuth callback (`/auth/callback`)
- Internal route — exchanges code for tokens, redirects to `/calendar`

---

## User Flow

1. User visits the app
2. Clicks "Connect Google Calendar"
3. Google OAuth consent screen — read-only `calendar.readonly` scope
4. Redirected back, tokens stored in a signed server-side session
5. App fetches all events for the current year (`timeMin` = Jan 1, `timeMax` = Dec 31)
6. Year view renders

---

## Google Calendar API

- **Scope:** `https://www.googleapis.com/auth/calendar.readonly`
- **Endpoint:** `GET /calendar/v3/calendars/{calendarId}/events`
  - Params: `timeMin`, `timeMax`, `singleEvents=true`, `orderBy=startTime`, `maxResults=2500`
- Fetch events from **all** of the user's calendars (list via `/calendar/v3/users/me/calendarList`)
- Handle pagination (`nextPageToken`) if the user has many events

---

## Non-functional Requirements

- No event data persisted to disk or database
- Tokens stored in an encrypted server-side session (e.g. `express-session` + `connect-crypto-session` or `iron-session`)
- HTTPS required in production (OAuth prerequisite)
- Works in modern browsers without a polyfill step
- Responsive — usable on a laptop; tablet/mobile is a nice-to-have

---

## Out of Scope (v1)

- Creating, editing, or deleting events
- Drag-and-drop rescheduling
- Multiple simultaneous users / multi-tenancy (single user per deployment is fine for now)
- Syncing / webhooks — a manual refresh button is sufficient
- Dark mode
- Week/month/day drill-down views beyond the two year views above

---

## Resolved Decisions

| Question | Decision |
|---|---|
| Week start day | Monday |
| Dense day overflow | Stack up to 3 event bars; show "+N more" for the rest |
| Year layout options | Two views: Timeline (12 rows) and Grid (3×4) |
| Default view | Timeline (12 rows) |
| Token refresh | Silent: server exchanges refresh token automatically; user only sees re-auth if refresh token is revoked |
| Calendar toggles | Collapsible sidebar, client-side filter (no refetch on toggle) |

## Open Questions

None — all decisions resolved. Ready to build.
