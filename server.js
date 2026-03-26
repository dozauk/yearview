import 'node:process';
import express from 'express';
import session from 'express-session';
import SqliteStore from 'better-sqlite3-session-store';
import Database from 'better-sqlite3';
import { google } from 'googleapis';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Trust Cloudflare / reverse proxy — needed for secure cookies behind HTTPS termination
app.set('trust proxy', 1);

// ── Session ────────────────────────────────────────────────────────────────
const SessionStore = SqliteStore(session);
const db = new Database(process.env.DB_PATH || join(__dirname, 'sessions.db'));

app.use(session({
  store: new SessionStore({ client: db, expired: { clear: true, intervalMs: 15 * 60 * 1000 } }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// ── Static files ───────────────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'public')));

// ── OAuth client factory ───────────────────────────────────────────────────
function makeOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/callback'
  );
}

// Restore tokens from session and handle silent refresh
function authedClient(req) {
  const tokens = req.session.tokens;
  if (!tokens) return null;
  const client = makeOAuthClient();
  client.setCredentials(tokens);
  // Persist refreshed tokens back to session automatically
  client.on('tokens', (refreshed) => {
    req.session.tokens = { ...tokens, ...refreshed };
  });
  return client;
}

// ── Auth routes ────────────────────────────────────────────────────────────
app.get('/auth/login', (_req, res) => {
  const client = makeOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',           // ensures refresh_token is always returned
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect('/?error=access_denied');
  try {
    const client = makeOAuthClient();
    const { tokens } = await client.getToken(code);
    req.session.tokens = tokens;
    res.redirect('/calendar.html');
  } catch {
    res.redirect('/?error=auth_failed');
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/auth/status', (req, res) => {
  res.json({ authenticated: !!req.session.tokens });
});

// ── API proxy ──────────────────────────────────────────────────────────────
// Middleware: require auth
function requireAuth(req, res, next) {
  if (!req.session.tokens) return res.status(401).json({ error: 'not_authenticated' });
  next();
}

// GET /api/calendars — list all calendars
app.get('/api/calendars', requireAuth, async (req, res) => {
  try {
    const auth = authedClient(req);
    const cal = google.calendar({ version: 'v3', auth });
    const { data } = await cal.calendarList.list({ minAccessRole: 'reader' });
    res.json(data.items.map(c => ({
      id: c.id,
      summary: c.summary,
      color: c.backgroundColor,
      primary: !!c.primary,
    })));
  } catch (err) {
    handleApiError(err, res);
  }
});

// Google Calendar event colorId → hex (standard 11-colour palette)
const EVENT_COLOR_MAP = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
  '5': '#f6bf26', '6': '#f4511e', '7': '#039be5', '8': '#616161',
  '9': '#3f51b5', '10': '#0b8043', '11': '#d50000',
};

// GET /api/events?year=2026 — fetch all events for the year across all calendars
app.get('/api/events', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const timeMin = new Date(year, 0, 1).toISOString();
    const timeMax = new Date(year, 11, 31, 23, 59, 59).toISOString();

    const auth = authedClient(req);
    const cal = google.calendar({ version: 'v3', auth });

    // Get calendar list first
    const { data: calList } = await cal.calendarList.list({ minAccessRole: 'reader' });
    const calendars = calList.items;

    // Fetch events from all calendars in parallel
    const results = await Promise.all(
      calendars.map(c => fetchAllEvents(cal, c.id, timeMin, timeMax))
    );

    // Flatten and tag each event with its calendarId
    const events = results.flatMap((evts, i) =>
      evts.map(e => ({
        id: e.id,
        calendarId: calendars[i].id,
        title: e.summary || '(no title)',
        start: e.start.dateTime || e.start.date,
        end: e.end.dateTime || e.end.date,
        allDay: !e.start.dateTime,
        calendarColor: calendars[i].backgroundColor || '#4285f4',
        eventColor: e.colorId ? (EVENT_COLOR_MAP[e.colorId] || null) : null,
        htmlLink: e.htmlLink || null,
      }))
    );

    res.json(events);
  } catch (err) {
    handleApiError(err, res);
  }
});

// Paginate through all events for a single calendar
async function fetchAllEvents(cal, calendarId, timeMin, timeMax) {
  const events = [];
  let pageToken;
  do {
    const { data } = await cal.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
      pageToken,
    });
    events.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return events;
}

function handleApiError(err, res) {
  console.error(err?.message || err);
  const status = err?.code === 401 ? 401 : 500;
  res.status(status).json({ error: err?.message || 'server_error' });
}

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`YearView running at http://localhost:${PORT}`));
