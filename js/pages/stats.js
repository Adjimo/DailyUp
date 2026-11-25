// Page Statistiques
import { todayKey, weekKey, weekDateKeys } from '../core/dates.js';
import { JOIN_DATE } from '../core/join.js';
import { dayInfo, weekMode } from '../core/calendar.js';

import { State } from '../core/state.js';
import { sportOn } from '../features/prefs.js';

import { formatDuration } from '../features/gpx.js';

import { RECORD_TYPES, activityVO2maxPoints, formatRecordValue, getRollingRecords } from '../features/records.js';

import { SUBJECTS, formatMinutes } from '../features/work.js';

import { el } from '../ui/helpers.js';

import { iconHtml, subjColor } from '../ui/icons.js';
import { render } from '../ui/router.js';


// Début de la période affichée dans les stats : arrivée dans l'app (ou première saisie si plus ancienne), jamais avant le 15 août.
export const STATS_FLOOR = '2026-08-15';
export function statsStartKey(logs) {
  const first = logs.filter(l => (l.totalMinutes || 0) > 0).map(l => l.date).sort()[0];
  let start = JOIN_DATE || STATS_FLOOR;
  if (first && first < start) start = first;
  return start < STATS_FLOOR ? STATS_FLOOR : start;
}
const longDate = (k) => new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
// Semaine « de cours » : lundi → vendredi sans vacances ni jour férié, hors révisions / concours / allégé.
function isCourseWeek(wk) {
  const days = weekDateKeys(wk).slice(0, 5);
  if (weekMode(days[0]) !== 'normal') return false;
  return days.every(k => { const i = dayInfo(k); return !i.vacation && !i.holiday; });
}

export function renderStats(root) {
  const page = el('div', { class: 'page' });
  page.appendChild(el('div', { class: 'page-title' }, [el('h1', {}, 'Stats')]));

  const acts = State.activities;
  const logs = State.workLogs;

  // Travail
  const totalWorkMin = logs.reduce((s, l) => s + (l.totalMinutes || 0), 0);
  const bestDayMin = logs.reduce((m, l) => Math.max(m, l.totalMinutes || 0), 0);
  const workDays = logs.filter(l => (l.totalMinutes || 0) > 0).length;
  const workByWeek = {};
  for (const l of logs) {
    const wk = weekKey(new Date(l.date));
    workByWeek[wk] = (workByWeek[wk] || 0) + (l.totalMinutes || 0);
  }
  const bestWeekMin = Math.max(0, ...Object.values(workByWeek));
  const bestCourseWeekMin = Math.max(0, ...Object.entries(workByWeek).filter(([wk]) => isCourseWeek(wk)).map(([, v]) => v));
  const weekValues = Object.values(workByWeek);
  const avgWeekMin = weekValues.length > 0
    ? weekValues.reduce((s, v) => s + v, 0) / weekValues.length
    : 0;
  // Progression : moyenne des 4 dernières semaines vs les 4 précédentes
  const sortedWeeks = Object.entries(workByWeek).sort((a, b) => a[0].localeCompare(b[0]));
  const recent4 = sortedWeeks.slice(-4).map(e => e[1]);
  const prev4 = sortedWeeks.slice(-8, -4).map(e => e[1]);
  const recent4Avg = recent4.length > 0 ? recent4.reduce((s, v) => s + v, 0) / recent4.length : 0;
  const prev4Avg = prev4.length > 0 ? prev4.reduce((s, v) => s + v, 0) / prev4.length : 0;
  const trendPct = prev4Avg > 0 ? Math.round((recent4Avg - prev4Avg) / prev4Avg * 100) : 0;

  page.appendChild(el('h3', { class: 'section-h work', html: iconHtml('books') + ' Travail' }));
  page.appendChild(el('div', { class: 'card mb-3', html: `
    <div class="totals">
      <div><div class="t-val grad-text">${(totalWorkMin/60).toFixed(1)}</div><div class="t-lbl">heures cumulées</div></div>
      <div><div class="t-val grad-text">${(avgWeekMin/60).toFixed(1)}</div><div class="t-lbl">moy. / semaine (h)</div></div>
      <div><div class="t-val grad-text">${(totalWorkMin/60/Math.max(1,workDays)).toFixed(1)}</div><div class="t-lbl">moy. / jour actif (h)</div></div>
      <div><div class="t-val grad-text" style="color: ${trendPct >= 0 ? 'var(--accent)' : 'var(--danger)'}">${trendPct >= 0 ? '+' : ''}${trendPct}%</div><div class="t-lbl">tendance 4 sem.</div></div>
    </div>
  `}));

  // Heatmap calendaire — régularité par mois, historique complet (glissable)
  page.appendChild(el('div', { class: 'chart-card mb-3' }, [
    el('div', { class: 'chart-title', html: iconHtml('calendar') + ' Régularité · par mois' }),
    el('div', { class: 'work-heatmap', id: 'work-heatmap' })
  ]));

  // Graph: répartition matières (30 derniers jours)
  page.appendChild(el('div', { class: 'chart-card mb-3' }, [
    el('div', { class: 'chart-title', html: iconHtml('target') + ' Répartition des matières · depuis le ' + longDate(statsStartKey(logs)) }),
    el('div', { class: 'chart-wrap chart-wrap-donut' }, [el('canvas', { id: 'chart-work-subjects' })])
  ]));

  page.appendChild(el('h3', { class: 'sub-h mb-2', html: iconHtml('trophy') + ' Records de travail' }));
  page.appendChild(el('div', { class: 'card mb-5', html: `
    <div class="rec-row"><div class="rec-left"><span class="rec-icon">${iconHtml('calendar')}</span><span class="rec-label">Plus grosse journée</span></div><div class="rec-value">${bestDayMin > 0 ? formatMinutes(bestDayMin) : '—'}</div></div>
    <div class="rec-row"><div class="rec-left"><span class="rec-icon">${iconHtml('calendar')}</span><span class="rec-label">Plus grosse semaine (toutes)</span></div><div class="rec-value">${bestWeekMin > 0 ? (bestWeekMin/60).toFixed(1) + 'h' : '—'}</div></div>
    <div class="rec-row"><div class="rec-left"><span class="rec-icon">${iconHtml('books')}</span><span class="rec-label">Plus grosse semaine de cours</span></div><div class="rec-value">${bestCourseWeekMin > 0 ? (bestCourseWeekMin/60).toFixed(1) + 'h' : '—'}</div></div>
  `}));

  if (sportOn()) {   // sans sport : ni statistiques ni records sportifs
  // Sport — refonte complète : focus sur les métriques runner
  const totalKm = acts.reduce((s, a) => s + (a.distanceKm || 0), 0);
  const totalDplus = acts.reduce((s, a) => s + (a.elevGain || 0), 0);
  const totalDur = acts.reduce((s, a) => s + (a.duration || 0), 0);

  page.appendChild(el('h3', { class: 'section-h sport', html: iconHtml('run') + ' Sport' }));
  page.appendChild(el('div', { class: 'card mb-3', html: `
    <div class="totals">
      <div><div class="t-val grad-text">${totalKm.toFixed(1)}</div><div class="t-lbl">km cumulés</div></div>
      <div><div class="t-val grad-text">${Math.round(totalDplus)}</div><div class="t-lbl">m de D+</div></div>
      <div><div class="t-val grad-text">${totalDur > 0 ? formatDuration(totalDur) : '0 h'}</div><div class="t-lbl">temps en sport</div></div>
      <div><div class="t-val grad-text">${acts.length}</div><div class="t-lbl">sorties</div></div>
    </div>
  `}));

  // ── Records absolus / 30j / 90j ────────────────────────────────────────
  const r30 = getRollingRecords(acts, 30);
  const r90 = getRollingRecords(acts, 90);
  const rAll = getRollingRecords(acts, 99999);
  const fmtT = (s) => {
    if (!s) return '—';
    const m = Math.floor(s / 60), sec = Math.round(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };
  page.appendChild(el('h3', { class: 'sub-h mt-4 mb-2', html: iconHtml('trophy') + ' Records glissants' }));
  page.appendChild(el('div', { class: 'card mb-3', html: `
    <div class="rolling-table">
      <div class="rolling-header"><div></div><div>Absolu</div><div>90 j</div><div>30 j</div></div>
      <div class="rolling-row"><div class="rolling-dist">1 km</div><div class="mono">${fmtT(rAll.best1k)}</div><div class="mono">${fmtT(r90.best1k)}</div><div class="mono">${fmtT(r30.best1k)}</div></div>
      <div class="rolling-row"><div class="rolling-dist">5 km</div><div class="mono">${fmtT(rAll.best5k)}</div><div class="mono">${fmtT(r90.best5k)}</div><div class="mono">${fmtT(r30.best5k)}</div></div>
      <div class="rolling-row"><div class="rolling-dist">10 km</div><div class="mono">${fmtT(rAll.best10k)}</div><div class="mono">${fmtT(r90.best10k)}</div><div class="mono">${fmtT(r30.best10k)}</div></div>
      <div class="rolling-row"><div class="rolling-dist">Semi</div><div class="mono">${fmtT(rAll.bestSemi)}</div><div class="mono">${fmtT(r90.bestSemi)}</div><div class="mono">${fmtT(r30.bestSemi)}</div></div>
    </div>
  `}));

  // ── Records personnels (existant, fin de page) ─────────────────────────
  page.appendChild(el('h3', { class: 'sub-h mt-4 mb-2', html: iconHtml('trophy') + ' Records sportifs' }));
  let recsHtml = '';
  for (const t of RECORD_TYPES) {
    const r = State.records[t.id];
    recsHtml += `
      <div class="rec-row">
        <div class="rec-left"><span class="rec-icon">${iconHtml(t.icon)}</span><span class="rec-label">${t.label}</span></div>
        <div class="rec-value">${r ? formatRecordValue(t, r.value) : '—'}</div>
      </div>
    `;
  }
  page.appendChild(el('div', { class: 'card mb-3', html: recsHtml }));
  }

  root.appendChild(page);

  // Graphes tracés tout de suite (le contenu est déjà dans la page) : rien ne saute après l'affichage.
  renderStatsCharts(logs, acts);
}

// Helpers de styling Chart.js cohérents avec la palette Orion.
const isLight = () => document.documentElement.dataset.theme === 'light';
export const CHART_COLORS = {
  get text() { return isLight() ? '#5E5242' : '#B8B2A7'; },
  get textMute() { return isLight() ? '#857A68' : '#8C8579'; },
  get grid() { return isLight() ? 'rgba(90, 70, 40, 0.14)' : 'rgba(187, 166, 119, 0.12)'; },
  get gold() { return isLight() ? '#8E5128' : '#E3B089'; },
  get goldFade() { return isLight() ? 'rgba(142, 81, 40, 0.16)' : 'rgba(230,195,106, 0.18)'; },
  warm: '#D08A4E',
  cool: '#C8814A',
  violet: '#b0705a',
  pink: '#B5703B',
  get bg() { return isLight() ? '#FBF8F2' : '#1E1E1E'; }
};

export function chartCommonOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: CHART_COLORS.text, font: { family: 'system-ui, -apple-system, sans-serif', size: 11 } } },
      tooltip: {
        backgroundColor: 'rgba(20,20,19,0.95)',
        titleColor: CHART_COLORS.gold,
        bodyColor: '#f0eee6',
        borderColor: 'rgba(230,195,106,0.2)',
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        ticks: { color: CHART_COLORS.textMute, font: { size: 10 } },
        grid: { color: CHART_COLORS.grid, drawBorder: false }
      },
      y: {
        ticks: { color: CHART_COLORS.textMute, font: { size: 10 } },
        grid: { color: CHART_COLORS.grid, drawBorder: false },
        beginAtZero: true
      }
    }
  };
}

export function renderStatsCharts(logs, acts) {
  // Détruit les anciennes instances pour permettre un re-render propre.
  for (const inst of Object.values(State.charts || {})) {
    try { inst?.destroy(); } catch {}
  }
  State.charts = {};
  if (window.Chart) Chart.defaults.animation = false;   // pas de tracé animé : les graphes apparaissent déjà formés

  // Travail : heatmap calendaire + donut matières
  renderWorkHeatmap(logs);
  if (!window.Chart) {   // bibliothèque de graphes non chargée (premier lancement hors ligne) : message au lieu d'un cadre vide
    document.querySelectorAll('.chart-wrap').forEach(w => { w.innerHTML = '<div class="chart-empty">Graphique indisponible hors connexion.<br>Il s’affichera dès que l’app aura pu le charger.</div>'; });
    return;
  }
  renderSubjectsDonut(logs);

  // Sport : courbe VO2max
  if (sportOn()) renderVO2maxChart(acts);
}

// Courbe d'évolution du VO2max (extraite de chaque sortie chronométrée).
export function renderVO2maxChart(acts) {
  const ctx = document.getElementById('chart-vo2');
  if (!ctx) return;
  const points = activityVO2maxPoints(acts);
  if (points.length < 2) return;
  const labels = points.map(p => new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
  const data = points.map(p => p.vo2);
  const ctxC = ctx.getContext('2d');
  const grad = ctxC.createLinearGradient(0, 0, 0, 160);
  grad.addColorStop(0, 'rgba(200,129,74, 0.4)');
  grad.addColorStop(1, 'rgba(200,129,74, 0)');
  State.charts.vo2 = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'VO₂max',
        data,
        borderColor: CHART_COLORS.violet,
        backgroundColor: grad,
        borderWidth: 2.5,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#E3B089',
        pointBorderColor: CHART_COLORS.bg,
        pointBorderWidth: 1.5,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...chartCommonOptions().plugins.tooltip,
          callbacks: {
            labelColor: (c) => { const col = c.dataset.backgroundColor[c.dataIndex]; return { borderColor: col, backgroundColor: col, borderWidth: 0, borderRadius: 3 }; },
            label: (c) => `${c.parsed.y} ml/kg/min`,
            title: (items) => points[items[0].dataIndex].name || items[0].label
          }
        }
      },
      scales: {
        x: { ticks: { color: CHART_COLORS.textMute, font: { size: 10 }, maxRotation: 0 }, grid: { display: false } },
        y: { ticks: { color: CHART_COLORS.textMute, font: { size: 10 } }, grid: { color: CHART_COLORS.grid, drawBorder: false } }
      }
    }
  });
}

// Heatmap en blocs par mois, glissable, depuis l'arrivée dans l'app (au plus tôt le 15 août) : rien avant cette date.
// Grosses cases pour le doigt ; une ligne « total » par semaine ; le détail (jour / semaine / mois, avec les matières)
// s'affiche dans un panneau fixe SOUS la grille, qui ne cache jamais les cases.
export function renderWorkHeatmap(logs) {
  const root = document.getElementById('work-heatmap');
  if (!root) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayK = todayKey(today);
  const startK = statsStartKey(logs);
  const startDate = new Date(startK + 'T00:00:00');
  const mondayOf = (d) => { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() + ((m.getDay() === 0 ? -6 : 1) - m.getDay())); return m; };
  const startMonday = mondayOf(startDate);
  const thisMonday = mondayOf(today);
  const nWeeks = Math.round((thisMonday - startMonday) / (7 * 86400000)) + 1;
  const byDate = new Map(logs.map(l => [l.date, l]));
  const bucket = (h) => (h <= 0 ? 0 : h < 2 ? 1 : h < 4 ? 2 : h < 6 ? 3 : 4);

  // Semaines → blocs par mois (mois du jeudi de la semaine).
  const blocks = [];
  for (let w = 0; w < nWeeks; w++) {
    const days = [];
    let weekMin = 0;
    for (let d = 0; d < 7; d++) {
      const date = new Date(startMonday); date.setDate(date.getDate() + w * 7 + d);
      const k = todayKey(date);
      const mins = byDate.get(k)?.totalMinutes || 0;
      const hidden = k < startK || k > todayK;   // avant l'arrivée / dans le futur : pas de case
      if (!hidden) weekMin += mins;
      days.push({ k, date, mins, level: bucket(mins / 60), hidden });
    }
    const thu = days[3].date;
    const id = thu.getFullYear() * 12 + thu.getMonth();
    let blk = blocks[blocks.length - 1];
    if (!blk || blk.id !== id) { blk = { id, date: thu, cols: [] }; blocks.push(blk); }
    blk.cols.push({ days, weekMin, wk: todayKey(days[0].date) });
  }

  // Cumuls (minutes totales + par matière) sur une liste de dates.
  const sumKeys = (keys) => {
    const by = {}; let total = 0;
    for (const k of keys) {
      const l = byDate.get(k); if (!l) continue;
      total += l.totalMinutes || 0;
      for (const [sj, m] of Object.entries(l.bySubject || {})) by[sj] = (by[sj] || 0) + m;
    }
    return { total, by };
  };
  const validKeys = (days) => days.filter(d => !d.hidden).map(d => d.k);
  const fmtDay = (k) => new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const monthName = (blk) => cap(blk.date.toLocaleDateString('fr-FR', { month: 'long' })) + (blk.date.getFullYear() !== today.getFullYear() ? ' ' + blk.date.getFullYear() : '');

  let html = '<div class="hm2"><div class="hm2-days"><div class="hm2-month-spacer"></div>';
  ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(l => { html += `<div class="hm2-daylabel">${l}</div>`; });
  html += '<div class="hm2-daylabel hm2-sigma" title="Total de la semaine">Σ</div></div>';
  html += '<div class="hm2-scroll" id="hm2-scroll"><div class="hm2-track">';
  const detailOf = {};   // id → { title, sum }
  blocks.forEach((blk, bi) => {
    const mKeys = blk.cols.flatMap(c => validKeys(c.days));
    detailOf[`m${bi}`] = { title: monthName(blk), sub: 'Total du mois', sum: sumKeys(mKeys) };
    html += `<div class="hm2-block"><button type="button" class="hm2-month" data-d="m${bi}">${monthName(blk)}</button><div class="hm2-cols">`;
    blk.cols.forEach((col, ci) => {
      html += '<div class="hm2-col">';
      col.days.forEach(c => {
        if (c.hidden) { html += '<div class="heatmap-cell hm2-off"></div>'; return; }
        detailOf[c.k] = { title: cap(fmtDay(c.k)), sub: '', sum: sumKeys([c.k]) };
        html += `<button type="button" class="heatmap-cell lvl-${c.level}" data-d="${c.k}" aria-label="${fmtDay(c.k)} : ${(c.mins / 60).toFixed(1)} h"></button>`;
      });
      const id = `w${bi}-${ci}`;
      const first = col.days.find(d => !d.hidden), last = [...col.days].reverse().find(d => !d.hidden);
      detailOf[id] = { title: first ? `Semaine du ${longDate(first.k)} au ${longDate(last.k)}` : 'Semaine', sub: 'Total de la semaine', sum: sumKeys(validKeys(col.days)) };
      html += `<button type="button" class="hm2-total" data-d="${id}" aria-label="Total de la semaine">${col.weekMin > 0 ? Math.round(col.weekMin / 60) + 'h' : '–'}</button>`;
      html += '</div>';
    });
    html += '</div></div>';
  });
  html += '</div></div></div>';
  html += '<div class="hm2-detail" id="hm2-detail"><div class="hm2-hint-d">Touche un jour, un total « Σ » ou un mois pour voir le détail.</div></div>';
  html += `<div class="heatmap-legend">
    <span class="hm2-hint">${nWeeks > 6 ? '← glisse pour remonter' : ''}</span>
    <span>moins</span>
    <div class="heatmap-cell lvl-0"></div><div class="heatmap-cell lvl-1"></div><div class="heatmap-cell lvl-2"></div><div class="heatmap-cell lvl-3"></div><div class="heatmap-cell lvl-4"></div>
    <span>plus</span>
  </div>`;
  root.innerHTML = html;
  const sc = root.querySelector('#hm2-scroll');
  if (sc) sc.scrollLeft = sc.scrollWidth;   // on arrive sur le mois en cours

  const panel = root.querySelector('#hm2-detail');
  const show = (id) => {
    const d = detailOf[id]; if (!d) return;
    const rows = Object.entries(d.sum.by).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]).map(([k, m]) => {
      const meta = SUBJECTS[k];
      return `<div class="popover-subject"><span>${iconHtml(meta?.icon || 'book')} ${meta?.label || k}</span><span class="mono">${formatMinutes(m)}</span></div>`;
    }).join('');
    panel.innerHTML = `<div class="hm2-d-head"><div><div class="popover-head">${d.title}</div>${d.sub ? `<div class="hm2-d-sub">${d.sub}</div>` : ''}</div>
      <div class="popover-total">${d.sum.total > 0 ? formatMinutes(d.sum.total) : 'Aucun travail'}</div></div>${rows ? `<div class="popover-subjects">${rows}</div>` : ''}`;
  };
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-d]'); if (!t || !root.contains(t)) return;
    root.querySelectorAll('.hm2-sel').forEach(n => n.classList.remove('hm2-sel'));
    t.classList.add('hm2-sel');
    show(t.dataset.d);
  });
}

export function renderSubjectsDonut(logs) {
  const ctx = document.getElementById('chart-work-subjects');
  if (!ctx) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const cutoffK = statsStartKey(logs);   // depuis l'arrivée dans l'app (au plus tôt le 15 août)
  const totals = {};
  for (const l of logs) {
    if (l.date < cutoffK) continue;
    for (const [subj, mins] of Object.entries(l.bySubject || {})) {
      totals[subj] = (totals[subj] || 0) + mins;
    }
  }
  const entries = Object.entries(totals).filter(([_, m]) => m > 0);
  if (entries.length === 0) {
    ctx.parentElement.innerHTML = '<div class="chart-empty">Pas encore de données</div>';
    return;
  }
  const palette = {
    maths: subjColor('maths'),
    physique: subjColor('physique'),
    si: subjColor('si'),
    langues: subjColor('langues'),
    francais: subjColor('francais'),
    autre: '#7d7664'
  };
  const totalH = entries.reduce((s, [_, m]) => s + m, 0) / 60;
  State.charts.subjects = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(([s]) => SUBJECTS[s]?.label || s),
      datasets: [{
        data: entries.map(([_, m]) => Math.round(m / 60 * 10) / 10),
        backgroundColor: entries.map(([s]) => palette[s] || '#999'),
        hoverBackgroundColor: entries.map(([s]) => palette[s] || '#999'),   // la couleur ne s'éclaircit plus au toucher
        borderColor: CHART_COLORS.bg,
        borderWidth: 3,
        hoverOffset: 10,
        hoverBorderColor: CHART_COLORS.bg
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'right', labels: { color: CHART_COLORS.text, font: { size: 11 }, boxWidth: 10, padding: 10, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: {
          ...chartCommonOptions().plugins.tooltip,
          callbacks: {
            labelColor: (c) => { const col = c.dataset.backgroundColor[c.dataIndex]; return { borderColor: col, backgroundColor: col, borderWidth: 0, borderRadius: 3 }; },
            label: (c) => {
              const pct = totalH > 0 ? Math.round(c.parsed / totalH * 100) : 0;
              return `${c.label} · ${c.parsed} h (${pct}%)`;
            }
          }
        }
      }
    }
  });
}
