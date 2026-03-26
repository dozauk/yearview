import { fetchCalendars, fetchEvents } from './api.js';
import { buildDayMap, formatEventTime, formatPopoverDate, resolveColors, openEditPopup, openNewEventPopup } from './util.js';
import { renderTimeline } from './timeline.js';
import { renderGrid } from './grid.js';

// ── State ──────────────────────────────────────────────────────────────────
let year        = new Date().getFullYear();
let view        = localStorage.getItem('yv-view') || 'timeline'; // 'timeline' | 'grid'
let align       = localStorage.getItem('yv-align') || 'weekday'; // 'weekday' | 'date'
let colorSource = localStorage.getItem('yv-color-source') || 'event'; // 'event' | 'calendar'
let showChip    = localStorage.getItem('yv-show-chip') !== 'false'; // default true
let calendars   = [];   // [{id, summary, color, primary}]
let events      = [];   // raw event list
let visibleIds  = new Set();
let sidebarOpen = localStorage.getItem('yv-sidebar') !== 'false';

// ── Elements ───────────────────────────────────────────────────────────────
const yearLabel      = document.getElementById('year-label');
const prevYearBtn    = document.getElementById('prev-year');
const nextYearBtn    = document.getElementById('next-year');
const viewTimelineBtn = document.getElementById('view-timeline');
const viewGridBtn    = document.getElementById('view-grid');
const alignToggle     = document.getElementById('align-toggle');
const alignWeekdayBtn = document.getElementById('align-weekday');
const alignDateBtn    = document.getElementById('align-date');
const colorFromEventBtn    = document.getElementById('color-from-event');
const colorFromCalendarBtn = document.getElementById('color-from-calendar');
const chipToggle      = document.getElementById('chip-toggle');
const refreshBtn      = document.getElementById('refresh-btn');
const sidebarToggle  = document.getElementById('sidebar-toggle');
const sidebar        = document.getElementById('sidebar');
const calendarList   = document.getElementById('calendar-list');
const selectAllBtn   = document.getElementById('select-all');
const deselectAllBtn = document.getElementById('deselect-all');
const loadingEl      = document.getElementById('loading');
const yearGrid       = document.getElementById('year-grid');
const popover        = document.getElementById('popover');
const popoverBackdrop = document.getElementById('popover-backdrop');
const popoverDate    = document.getElementById('popover-date');
const popoverEvents  = document.getElementById('popover-events');
const popoverClose   = document.getElementById('popover-close');

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  applySidebarState();
  applyViewButtons();
  applySettings();
  yearLabel.textContent = year;
  await loadData();
}

async function loadData() {
  loadingEl.hidden = false;
  yearGrid.hidden = true;
  try {
    [calendars, events] = await Promise.all([fetchCalendars(), fetchEvents(year)]);
    visibleIds = new Set(calendars.map(c => c.id));
    renderSidebar();
    render();
  } catch (e) {
    loadingEl.textContent = 'Failed to load events. Please refresh.';
    console.error(e);
  }
}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  loadingEl.hidden = true;
  yearGrid.hidden = false;
  const dayMap = buildDayMap(events, visibleIds);
  alignToggle.style.display = view === 'timeline' ? '' : 'none';
  const colorOpts = { colorSource, showChip };
  if (view === 'timeline') {
    renderTimeline(yearGrid, year, events, visibleIds, openPopover, align, colorOpts);
  } else {
    const dayMap = buildDayMap(events, visibleIds);
    renderGrid(yearGrid, year, dayMap, openPopover, colorOpts);
  }
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function renderSidebar() {
  calendarList.innerHTML = '';
  calendars.forEach(cal => {
    const li = document.createElement('li');
    li.dataset.id = cal.id;

    const box = document.createElement('div');
    box.className = 'cal-checkbox' + (visibleIds.has(cal.id) ? ' checked' : '');
    box.style.color = cal.color || '#4285f4';
    box.style.borderColor = cal.color || '#4285f4';
    if (visibleIds.has(cal.id)) box.style.background = cal.color || '#4285f4';

    const name = document.createElement('span');
    name.className = 'cal-name';
    name.textContent = cal.summary;
    name.title = cal.summary;

    li.appendChild(box);
    li.appendChild(name);
    li.addEventListener('click', () => toggleCalendar(cal.id));
    calendarList.appendChild(li);
  });
}

function toggleCalendar(id) {
  if (visibleIds.has(id)) visibleIds.delete(id);
  else visibleIds.add(id);
  updateCalendarItem(id);
  render();
}

function updateCalendarItem(id) {
  const cal = calendars.find(c => c.id === id);
  const li = calendarList.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (!li || !cal) return;
  const box = li.querySelector('.cal-checkbox');
  const on = visibleIds.has(id);
  box.className = 'cal-checkbox' + (on ? ' checked' : '');
  box.style.background = on ? (cal.color || '#4285f4') : '';
}

function applySettings() {
  colorFromEventBtn.classList.toggle('active', colorSource === 'event');
  colorFromCalendarBtn.classList.toggle('active', colorSource === 'calendar');
  chipToggle.checked = showChip;
}

function applySidebarState() {
  sidebar.classList.toggle('collapsed', !sidebarOpen);
}

// ── Popover ────────────────────────────────────────────────────────────────
function openPopover(dateKey, dayEvents) {
  popoverDate.textContent = formatPopoverDate(dateKey);
  popoverEvents.innerHTML = '';

  // New event link always at the top
  const newLi = document.createElement('li');
  newLi.className = 'popover-new-event';
  const newLink = document.createElement('a');
  newLink.className = 'popover-event-link';
  newLink.href = '#';
  newLink.textContent = '+ New event';
  newLink.addEventListener('click', ev => { ev.preventDefault(); openNewEventPopup(dateKey); });
  newLi.appendChild(newLink);
  popoverEvents.appendChild(newLi);

  // Filter to visible calendars
  const visible = dayEvents.filter(e => visibleIds.has(e.calendarId));

  visible.forEach(e => {
    const cal = calendars.find(c => c.id === e.calendarId);
    const li = document.createElement('li');
    li.className = 'popover-event';

    const dot = document.createElement('div');
    dot.className = 'popover-dot';
    dot.style.background = resolveColors(e, colorSource).primary;

    const info = document.createElement('div');
    info.className = 'popover-event-info';

    const titleEl = document.createElement('div');
    titleEl.className = 'popover-event-title';
    titleEl.textContent = e.title;

    const timeEl = document.createElement('div');
    timeEl.className = 'popover-event-time';
    timeEl.textContent = formatEventTime(e);

    const calEl = document.createElement('div');
    calEl.className = 'popover-event-cal';
    calEl.textContent = cal?.summary || '';

    info.appendChild(titleEl);
    info.appendChild(timeEl);
    info.appendChild(calEl);
    if (e.editLink) {
      const linkEl = document.createElement('a');
      linkEl.className = 'popover-event-link';
      linkEl.href = e.editLink;
      linkEl.textContent = 'Edit in Google Calendar →';
      linkEl.addEventListener('click', ev => {
        ev.preventDefault();
        openEditPopup(e.editLink);
      });
      info.appendChild(linkEl);
    }
    li.appendChild(dot);
    li.appendChild(info);
    popoverEvents.appendChild(li);
  });

  // Position near centre of viewport
  popover.style.top = '50%';
  popover.style.left = '50%';
  popover.style.transform = 'translate(-50%, -50%)';
  popover.hidden = false;
  popoverBackdrop.hidden = false;
}

function closePopover() {
  popover.hidden = true;
  popoverBackdrop.hidden = true;
}

// ── Event listeners ────────────────────────────────────────────────────────
prevYearBtn.addEventListener('click', () => {
  year--;
  yearLabel.textContent = year;
  loadData();
});

nextYearBtn.addEventListener('click', () => {
  year++;
  yearLabel.textContent = year;
  loadData();
});

viewTimelineBtn.addEventListener('click', () => {
  view = 'timeline';
  localStorage.setItem('yv-view', view);
  applyViewButtons();
  render();
});

viewGridBtn.addEventListener('click', () => {
  view = 'grid';
  localStorage.setItem('yv-view', view);
  applyViewButtons();
  render();
});

function applyViewButtons() {
  viewTimelineBtn.classList.toggle('active', view === 'timeline');
  viewGridBtn.classList.toggle('active', view === 'grid');
  alignWeekdayBtn.classList.toggle('active', align === 'weekday');
  alignDateBtn.classList.toggle('active', align === 'date');
  alignToggle.style.display = view === 'timeline' ? '' : 'none';
}

alignWeekdayBtn.addEventListener('click', () => {
  align = 'weekday';
  localStorage.setItem('yv-align', align);
  applyViewButtons();
  render();
});

alignDateBtn.addEventListener('click', () => {
  align = 'date';
  localStorage.setItem('yv-align', align);
  applyViewButtons();
  render();
});

refreshBtn.addEventListener('click', loadData);

sidebarToggle.addEventListener('click', () => {
  sidebarOpen = !sidebarOpen;
  localStorage.setItem('yv-sidebar', sidebarOpen);
  applySidebarState();
});

selectAllBtn.addEventListener('click', () => {
  visibleIds = new Set(calendars.map(c => c.id));
  renderSidebar();
  render();
});

deselectAllBtn.addEventListener('click', () => {
  visibleIds = new Set();
  renderSidebar();
  render();
});

colorFromEventBtn.addEventListener('click', () => {
  colorSource = 'event';
  localStorage.setItem('yv-color-source', colorSource);
  applySettings();
  render();
});

colorFromCalendarBtn.addEventListener('click', () => {
  colorSource = 'calendar';
  localStorage.setItem('yv-color-source', colorSource);
  applySettings();
  render();
});

chipToggle.addEventListener('change', () => {
  showChip = chipToggle.checked;
  localStorage.setItem('yv-show-chip', showChip);
  render();
});

popoverClose.addEventListener('click', closePopover);
popoverBackdrop.addEventListener('click', closePopover);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePopover(); });

// ── Version footer ─────────────────────────────────────────────────────────
async function loadVersion() {
  try {
    const { sha, built } = await fetch('/api/version').then(r => r.json());
    const short = sha === 'dev' ? 'dev' : sha.slice(0, 7);
    const date = built === 'local' ? 'local' : new Date(built).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('version-label').textContent = `v${short} · ${date}`;
  } catch { /* non-critical */ }
}

// ── Go ─────────────────────────────────────────────────────────────────────
init();
loadVersion();
