// View B: 3-column × 4-row month grid
import { DAYS, MONTHS, monthGridDays, toWeeks, ymd, todayYmd, resolveColors, openEditPopup } from './util.js';

const MAX_BARS = 3;

export function renderGrid(container, year, dayMap, onDayClick, colorOpts = {}) {
  const { colorSource = 'event', showChip = true } = colorOpts;
  container.innerHTML = '';
  const today = todayYmd();

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

    // Weeks
    weeks.forEach(week => {
      const weekEl = document.createElement('div');
      weekEl.className = 'grid-week';

      week.forEach(date => {
        const key = ymd(date);
        const isThisMonth = date.getMonth() === m;
        const events = dayMap[key] || [];

        const cell = document.createElement('div');
        cell.className = 'grid-cell' +
          (key === today ? ' today' : '') +
          (!isThisMonth ? ' other-month' : '');
        cell.dataset.date = key;

        const num = document.createElement('div');
        num.className = 'day-num';
        num.textContent = date.getDate();
        cell.appendChild(num);

        cell.addEventListener('click', ev => onDayClick(key, events, ev.currentTarget));
        renderEventBars(cell, events, key, onDayClick, colorSource, showChip);
        weekEl.appendChild(cell);
      });

      monthEl.appendChild(weekEl);
    });

    gridEl.appendChild(monthEl);
  }

  container.appendChild(gridEl);
}

function renderEventBars(cell, events, key, onDayClick, colorSource, showChip) {
  const visible = events.slice(0, MAX_BARS);
  const overflow = events.length - MAX_BARS;

  visible.forEach(e => {
    const { primary, chip } = resolveColors(e, colorSource);
    const bar = document.createElement('span');
    bar.className = 'event-bar';
    bar.style.background = primary;
    bar.textContent = e.title;
    bar.title = e.title;
    if (showChip && chip) {
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
        onDayClick(key, events, anchorEl);
      }, 220);
    });
    bar.addEventListener('dblclick', ev => {
      ev.stopPropagation();
      clearTimeout(clickTimer); clickTimer = null;
      openEditPopup(e.editLink);
    });
    cell.appendChild(bar);
  });

  if (overflow > 0) {
    const more = document.createElement('span');
    more.className = 'more-link';
    more.textContent = `+${overflow} more`;
    more.addEventListener('click', ev => { ev.stopPropagation(); onDayClick(key, events, ev.currentTarget); });
    cell.appendChild(more);
  }
}
