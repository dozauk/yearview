// Thin wrappers around the server API

export async function fetchCalendars() {
  const res = await fetch('/api/calendars');
  if (!res.ok) throw new Error('Failed to load calendars');
  return res.json();
}

export async function fetchEvents(year) {
  const res = await fetch(`/api/events?year=${year}`);
  if (!res.ok) {
    if (res.status === 401) { location.href = '/'; return []; }
    throw new Error('Failed to load events');
  }
  return res.json();
}
