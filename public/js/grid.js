// View B: 3-column × 4-row month grid
// Multi-day events rendered as spanning bars in a per-week overlay layer,
// matching the timeline view's lane-based approach.
import { DAYS, MONTHS, monthGridDays, toWeeks, todayYmd, resolveColors, openEditPopup } from './util.js';

const MAX_LANES = 3;

// Local-time YYYY-MM-DD (avoids toISOString() UTC offset issues with midnight dates)
function localYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Google all-day end dates are exclusive — subtract one day
function allDayEndInclusive(isoStr) {
  const d = new Date(isoStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return localYmd(d);
}

// Greedy lane assignment — mutates each event, adds .lane
function assignLanes(events) {
  const laneEnd = [];
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

export function renderGrid(container, year, allEvents, visibleIds, onDayClick, colorOpts = {}) {
  const { colorSource = 'event', showChip = true, timedStyle = 'bar', fadePast = true } = colorOpts;
  container.innerHTML = '';
  const today = todayYmd();

  // Filter to visible calendars once
  const events = allEvents.filter(e => visibleIds.has(e.calendarId));

  const gridEl = document.createElement('div');
  gridEl.className = 'grid-months';

  for (let m = 0; m < 12; m++) {
    const days = monthGridDays(year, m);
    const weeks = toWeeks(days);

    const monthEl = document.createElement('div');
    monthEl.className = 'grid-month';

    // Month title
    const title = document.createElement('div');
    title.className = 'grid-month-title';
    title.textContent = MONTHS[m];
    monthEl.appendChild(title);

    // DOW header
    const dowRow = document.createElement('div');
    dowRow.className = 'grid-dow-row';
    DAYS.forEach(d => {
      const cell = document.createElement('div');
      cell.className = 'dow';
      cell.textContent = d[0];
      dowRow.appendChild(cell);
    });
    monthEl.appendChild(dowRow);

    // ── One wrapper per week ───────────────────────────────────────────
    weeks.forEach(week => {
      const wStart = localYmd(week[0]);
      const wEnd   = localYmd(week[6]);
      // Build local-ymd strings for fast column lookup
      const weekYmds = week.map(localYmd);

      // Build positioned events clipped to this week
      const positioned = [];
      for (const e of events) {
        const eStart = e.start.slice(0, 10);
        const eEnd   = e.allDay ? allDayEndInclusive(e.end) : e.end.slice(0, 10);
        if (eStart > wEnd || eEnd < wStart) continue;

        const clippedStart = eStart < wStart ? wStart : eStart;
        const clippedEnd   = eEnd   > wEnd   ? wEnd   : eEnd;

        const csIdx = weekYmds.indexOf(clippedStart);
        const ceIdx = weekYmds.indexOf(clippedEnd);

        positioned.push({
          ...e,
          eStart, eEnd,
          clippedStart, clippedEnd,
          startsInWeek: eStart >= wStart,
          endsInWeek:   eEnd   <= wEnd,
          colStart: csIdx >= 0 ? csIdx : 0,
          colEnd:   ceIdx >= 0 ? ceIdx : 6,
        });
      }

      // Sort: earlier start first; ties by longer span first
      positioned.sort((a, b) =>
        a.colStart !== b.colStart
          ? a.colStart - b.colStart
          : (b.colEnd - b.colStart) - (a.colEnd - a.colStart)
      );
      assignLanes(positioned);

      const shownEvents  = positioned.filter(e => e.lane < MAX_LANES);
      const hiddenEvents = positioned.filter(e => e.lane >= MAX_LANES);

      const hiddenByCol = new Array(7).fill(0);
      for (const e of hiddenEvents) {
        for (let c = e.colStart; c <= e.colEnd; c++) hiddenByCol[c]++;
      }

      // Week wrapper (positions the overlay on top of the bg cells)
      const wrapper = document.createElement('div');
      wrapper.className = 'grid-week-wrapper';

      // Layer 1: background cells
      const bgRow = document.createElement('div');
      bgRow.className = 'grid-week';

      week.forEach((date, col) => {
        const key = localYmd(date);
        const isThisMonth = date.getMonth() === m;

        const cell = document.createElement('div');
        cell.className = 'grid-cell' +
          (key === today             ? ' today'      : '') +
          (!isThisMonth             ? ' other-month' : '') +
          (fadePast && key < today  ? ' past-day'    : '');
        cell.dataset.date = key;

        const num = document.createElement('div');
        num.className = 'day-num';
        num.textContent = date.getDate();
        cell.appendChild(num);

        cell.addEventListener('click', ev => {
          const dayEvts = positioned.filter(e => e.colStart <= col && e.colEnd >= col);
          onDayClick(key, dayEvts, ev.currentTarget);
        });
        bgRow.appendChild(cell);
      });
      wrapper.appendChild(bgRow);

      // Layer 2: event overlay
      const evLayer = document.createElement('div');
      evLayer.className = 'grid-events-layer';

      for (const e of shownEvents) {
        const { primary, chip } = resolveColors(e, colorSource);
        const asText = timedStyle === 'text' && !e.allDay && e.colStart === e.colEnd;
        const isPast = fadePast && e.eEnd < today;

        const bar = document.createElement('div');
        bar.className = 'event-bar grid-event-bar' +
          (!e.startsInWeek ? ' continues-left'  : '') +
          (!e.endsInWeek   ? ' continues-right' : '') +
          (asText          ? ' event-text'       : '') +
          (isPast          ? ' past-event'       : '');
        if (asText) {
          bar.style.color = primary;
        } else {
          bar.style.background = primary;
        }
        bar.style.gridColumn = `${e.colStart + 1} / ${e.colEnd + 2}`;
        bar.style.gridRow    = String(e.lane + 1);
        bar.textContent      = e.title;
        bar.title            = e.title;
        if (!asText && showChip && chip) {
          const chipEl = document.createElement('span');
          chipEl.className = 'color-chip';
          chipEl.style.background = chip;
          bar.appendChild(chipEl);
        }

        let clickTimer = null;
        bar.addEventListener('click', ev => {
          ev.stopPropagation();
          if (clickTimer) return;
          const anchorEl = ev.currentTarget;
          clickTimer = setTimeout(() => {
            clickTimer = null;
            const col = e.colStart;
            const dayEvts = positioned.filter(pe => pe.colStart <= col && pe.colEnd >= col);
            onDayClick(e.clippedStart, dayEvts, anchorEl);
          }, 220);
        });
        bar.addEventListener('dblclick', ev => {
          ev.stopPropagation();
          clearTimeout(clickTimer); clickTimer = null;
          openEditPopup(e.editLink);
        });
        evLayer.appendChild(bar);
      }

      // "+N more" per overflow column
      for (let c = 0; c < 7; c++) {
        if (!hiddenByCol[c]) continue;
        const key = weekYmds[c];
        const more = document.createElement('div');
        more.className = 'more-link grid-more-item';
        more.textContent = `+${hiddenByCol[c]}`;
        more.style.gridColumn = `${c + 1} / ${c + 2}`;
        more.style.gridRow    = String(MAX_LANES + 1);
        more.addEventListener('click', ev => {
          ev.stopPropagation();
          const dayEvts = positioned.filter(e => e.colStart <= c && e.colEnd >= c);
          onDayClick(key, dayEvts, ev.currentTarget);
        });
        evLayer.appendChild(more);
      }

      wrapper.appendChild(evLayer);
      monthEl.appendChild(wrapper);
    });

    gridEl.appendChild(monthEl);
  }

  container.appendChild(gridEl);
}
