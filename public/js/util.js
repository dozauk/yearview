// Shared date/event helpers

export const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const MONTHS = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

// Return YYYY-MM-DD string for a Date
export function ymd(date) {
  return date.toISOString().slice(0, 10);
}

// Return today's YYYY-MM-DD in local time
export function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// First Monday on or before the 1st of the month
export function weekStart(year, month) {
  const d = new Date(year, month, 1);
  const dow = d.getDay(); // 0=Sun..6=Sat
  const offset = dow === 0 ? -6 : 1 - dow; // shift to Monday
  return new Date(year, month, 1 + offset);
}

// Build array of Date objects for all days in the 7-col grid for a month
// (may include trailing/leading days from adjacent months)
export function monthGridDays(year, month) {
  const start = weekStart(year, month);
  const days = [];
  const d = new Date(start);
  // Keep going until we've covered the full month and end on a Sunday
  while (d.getMonth() !== month || d.getDay() !== 1 || days.length === 0) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
    if (days.length > 7 * 6) break; // safety
    // Stop after the Sunday that is >= end of month
    if (days.length >= 28 && d.getDay() === 1 && d.getMonth() !== month) break;
  }
  return days;
}

// Group a flat days array into weeks (arrays of 7)
export function toWeeks(days) {
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

// Given events (filtered by visible calendars), return a map: ymd → [event,…]
export function buildDayMap(events, visibleIds) {
  const map = {};
  for (const e of events) {
    if (!visibleIds.has(e.calendarId)) continue;
    const start = e.start.slice(0, 10);
    const end   = e.allDay
      ? offsetDate(e.end, -1)   // Google all-day end is exclusive
      : e.end.slice(0, 10);
    // Span every day the event covers
    const d = new Date(start + 'T00:00:00');
    const endD = new Date(end + 'T00:00:00');
    while (d <= endD) {
      const key = ymd(d);
      (map[key] = map[key] || []).push(e);
      d.setDate(d.getDate() + 1);
    }
  }
  return map;
}

function offsetDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return ymd(d);
}

// Format a date for display in popovers
export function formatEventTime(event) {
  if (event.allDay) return 'All day';
  const d = new Date(event.start);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Open the Google Calendar event editor in a centred popup window
export function openEditPopup(url) {
  if (!url) return;
  const w = 920, h = 720;
  const left = Math.round((screen.width  - w) / 2);
  const top  = Math.round((screen.height - h) / 2);
  window.open(url, 'gcal-edit',
    `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
}

// Resolve primary bar colour and optional secondary chip colour.
// colorSource: 'event' → bar=eventColor (fallback calendarColor), chip=calendarColor if different
//              'calendar' → bar=calendarColor, chip=eventColor if set
export function resolveColors(event, colorSource) {
  const cal = event.calendarColor || '#4285f4';
  const evt = event.eventColor || null;
  if (colorSource === 'calendar') {
    return { primary: cal, chip: evt && evt !== cal ? evt : null };
  }
  // default: 'event'
  return { primary: evt || cal, chip: evt && evt !== cal ? cal : null };
}

export function formatPopoverDate(ymdStr) {
  const [y, m, day] = ymdStr.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
