// View A: 12 flat month rows
// Multi-day events are rendered as CSS-grid-spanning bars in an overlay layer.
// Single-day events share the same overlay approach for consistent lane stacking.
//
// align: 'weekday' → months offset so weekdays align vertically (~35-37 cols)
//        'date'    → strict 31 cols, all months aligned by date number

import { DAYS, MONTHS, todayYmd, resolveColors } from './util.js';

const MAX_LANES = 3; // visible event rows per day before "+N more"

// ── Helpers ────────────────────────────────────────────────────────────────

function monthStartOffset(year, month) {
  // Monday = 0 … Sunday = 6
  const dow = new Date(year, month, 1).getDay();
  return dow === 0 ? 6 : dow - 1;
}

function totalCols(year, align) {
  if (align === 'date') return 31;
  let max = 0;
  for (let m = 0; m < 12; m++) {
    const days = new Date(year, m + 1, 0).getDate();
    max = Math.max(max, monthStartOffset(year, m) + days);
  }
  return max;
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Google all-day end dates are exclusive — subtract one day
function allDayEndInclusive(isoStr) {
  const d = new Date(isoStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

// Greedy lane assignment — mutates each event, adds .lane
function assignLanes(events) {
  const laneEnd = []; // last colEnd occupying each lane
  for (const e of events) {
    let placed = false;
    for (let i = 0; i < laneEnd.length; i++) {
      if (laneEnd[i] < e.colStart) {
        e.lane = i;
        laneEnd[i] = e.colEnd;
        placed = true;
        break;
      }
    }
    if (!placed) {
      e.lane = laneEnd.length;
      laneEnd.push(e.colEnd);
    }
  }
}

// ── Main export ────────────────────────────────────────────────────────────

export function renderTimeline(container, year, allEvents, visibleIds, onDayClick, align = 'weekday', colorOpts = {}) {
  const { colorSource = 'event', showChip = true } = colorOpts;
  container.innerHTML = '';
  const today = todayYmd();
  const cols = totalCols(year, align);
  const gridTpl = `repeat(${cols}, 1fr)`;

  // Filter to visible calendars once
  const events = allEvents.filter(e => visibleIds.has(e.calendarId));

  // ── Header row ────────────────────────────────────────────────────────
  const headerRow = document.createElement('div');
  headerRow.className = 'tl-row tl-header-row';

  const hSpacer = document.createElement('div');
  hSpacer.className = 'tl-label';
  headerRow.appendChild(hSpacer);

  const hCols = document.createElement('div');
  hCols.className = 'tl-cols tl-bg-grid';
  hCols.style.gridTemplateColumns = gridTpl;

  for (let c = 0; c < cols; c++) {
    const cell = document.createElement('div');
    cell.className = 'tl-header-cell';
    if (align === 'date') {
      cell.textContent = c + 1;
    } else {
      const dow = c % 7;
      cell.textContent = DAYS[dow][0];
      if (dow >= 5) cell.classList.add('weekend');
    }
    hCols.appendChild(cell);
  }
  headerRow.appendChild(hCols);
  container.appendChild(headerRow);

  // ── One row per month ─────────────────────────────────────────────────
  for (let m = 0; m < 12; m++) {
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const offset = align === 'weekday' ? monthStartOffset(year, m) : 0;
    const mm = String(m + 1).padStart(2, '0');
    const monthStart = `${year}-${mm}-01`;
    const monthEnd   = `${year}-${mm}-${String(daysInMonth).padStart(2, '0')}`;

    // Build positioned events clipped to this month
    const positioned = [];
    for (const e of events) {
      const eStart = e.start.slice(0, 10);
      const eEnd   = e.allDay ? allDayEndInclusive(e.end) : e.end.slice(0, 10);
      if (eStart > monthEnd || eEnd < monthStart) continue; // no overlap

      const clippedStart = eStart < monthStart ? monthStart : eStart;
      const clippedEnd   = eEnd   > monthEnd   ? monthEnd   : eEnd;

      const startDay = parseInt(clippedStart.slice(8), 10);
      const endDay   = parseInt(clippedEnd.slice(8), 10);

      positioned.push({
        ...e,
        eStart, eEnd,
        clippedStart, clippedEnd,
        startsInMonth: eStart >= monthStart,
        endsInMonth:   eEnd   <= monthEnd,
        colStart: offset + startDay - 1, // 0-indexed
        colEnd:   offset + endDay   - 1,
      });
    }

    // Sort: earlier start first; ties broken by longer duration first
    positioned.sort((a, b) =>
      a.colStart !== b.colStart
        ? a.colStart - b.colStart
        : (b.colEnd - b.colStart) - (a.colEnd - a.colStart)
    );
    assignLanes(positioned);

    const shownEvents  = positioned.filter(e => e.lane < MAX_LANES);
    const hiddenEvents = positioned.filter(e => e.lane >= MAX_LANES);

    // Count hidden events per column for "+N more"
    const hiddenByCol = new Array(cols).fill(0);
    for (const e of hiddenEvents) {
      for (let c = e.colStart; c <= e.colEnd; c++) hiddenByCol[c]++;
    }

    // ── Row ──────────────────────────────────────────────────────────
    const row = document.createElement('div');
    row.className = 'tl-row tl-month-row';

    const label = document.createElement('div');
    label.className = 'tl-label';
    label.textContent = MONTHS[m].slice(0, 3);
    row.appendChild(label);

    const wrapper = document.createElement('div');
    wrapper.className = 'tl-cols-wrapper';

    // Layer 1: background cells (borders, today/weekend colours, day numbers)
    const bgGrid = document.createElement('div');
    bgGrid.className = 'tl-cols tl-bg-grid';
    bgGrid.style.gridTemplateColumns = gridTpl;

    for (let c = 0; c < cols; c++) {
      const dayNum  = c - offset + 1;
      const isReal  = dayNum >= 1 && dayNum <= daysInMonth;
      const dow      = c % 7;
      const isWeekend = align === 'weekday' && dow >= 5;

      const cell = document.createElement('div');

      if (!isReal) {
        cell.className = 'tl-cell tl-empty' + (isWeekend ? ' weekend' : '');
        bgGrid.appendChild(cell);
        continue;
      }

      const dateStr = `${year}-${mm}-${String(dayNum).padStart(2, '0')}`;
      cell.className = 'tl-cell' +
        (dateStr === today  ? ' today'   : '') +
        (isWeekend          ? ' weekend' : '');
      cell.dataset.date = dateStr;

      const num = document.createElement('div');
      num.className = 'day-num';
      num.textContent = dayNum;
      cell.appendChild(num);

      // Click on cell background → open popover for that day
      const col = c;
      cell.addEventListener('click', () => {
        const dayEvts = positioned.filter(e => e.colStart <= col && e.colEnd >= col);
        if (dayEvts.length) onDayClick(dateStr, dayEvts);
      });

      bgGrid.appendChild(cell);
    }
    wrapper.appendChild(bgGrid);

    // Layer 2: event overlay (absolutely positioned over the bg cells)
    const evLayer = document.createElement('div');
    evLayer.className = 'tl-events-layer';
    evLayer.style.gridTemplateColumns = gridTpl;

    // Spanning event bars
    for (const e of shownEvents) {
      const { primary, chip } = resolveColors(e, colorSource);
      const bar = document.createElement('div');
      bar.className = 'event-bar tl-event-bar' +
        (!e.startsInMonth ? ' continues-left'  : '') +
        (!e.endsInMonth   ? ' continues-right' : '');
      bar.style.background = primary;
      bar.style.gridColumn  = `${e.colStart + 1} / ${e.colEnd + 2}`;
      bar.style.gridRow     = String(e.lane + 1);
      bar.textContent       = e.title;
      bar.title             = e.title;
      if (showChip && chip) {
        const chipEl = document.createElement('span');
        chipEl.className = 'color-chip';
        chipEl.style.background = chip;
        bar.appendChild(chipEl);
      }

      bar.addEventListener('click', ev => {
        ev.stopPropagation();
        const col = e.colStart;
        const dayEvts = positioned.filter(pe => pe.colStart <= col && pe.colEnd >= col);
        onDayClick(e.clippedStart, dayEvts);
      });
      bar.addEventListener('dblclick', ev => {
        ev.stopPropagation();
        if (e.htmlLink) window.open(e.htmlLink, '_blank', 'noopener');
      });
      evLayer.appendChild(bar);
    }

    // "+N more" per overflow column
    for (let c = 0; c < cols; c++) {
      if (!hiddenByCol[c]) continue;
      const dayNum = c - offset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) continue;
      const dateStr = `${year}-${mm}-${String(dayNum).padStart(2, '0')}`;

      const more = document.createElement('div');
      more.className = 'more-link tl-more-item';
      more.textContent = `+${hiddenByCol[c]}`;
      more.style.gridColumn = `${c + 1} / ${c + 2}`;
      more.style.gridRow = String(MAX_LANES + 1);

      const col = c;
      more.addEventListener('click', ev => {
        ev.stopPropagation();
        const dayEvts = positioned.filter(e => e.colStart <= col && e.colEnd >= col);
        onDayClick(dateStr, dayEvts);
      });
      evLayer.appendChild(more);
    }

    wrapper.appendChild(evLayer);
    row.appendChild(wrapper);
    container.appendChild(row);
  }
}
