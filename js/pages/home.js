// Page Accueil
import { daysUntil, formatDate, todayKey } from '../core/dates.js';
import { addDays, isRestDay, mondayOf } from '../core/calendar.js';
import { dbAll } from '../core/db.js';
import { formatDuration } from '../features/planning.js';
import { weekGoalsFor } from '../features/work-goals.js';
import { State } from '../core/state.js';
import { dbPut } from '../core/db.js';
import { MAX_LEVEL, deriveLevel } from '../core/xp.js';
import { computeYearProgress } from '../features/exams.js';
import { loadAll } from '../features/seed.js';
import { el, escapeHtml, progressBar } from '../ui/helpers.js';
import { iconHtml } from '../ui/icons.js';
import { navigate, render } from '../ui/router.js';
import { renderCaracsCard } from './caracs-card.js';
import { renderCaracPanels } from './skills-panels.js';
import { gamifyOn } from '../features/prefs.js';

export function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Encore debout ?';
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  if (h < 22) return 'Bonsoir';
  return 'Bonne nuit';
}

export function renderHome(root) {
  const p = State.profile;
  if (!p) return;
  const li = deriveLevel(p.totalXp);

  const futureExams = State.exams
    .filter(e => e.enabled !== false)
    .map(e => ({ ...e, days: daysUntil(e.date) }))
    .filter(e => e.days >= 0)
    .sort((a, b) => a.days - b.days);
  const nextExam = futureExams[0];

  const page = el('div', { class: 'page' });
  const fit = el('div', { class: 'home-fit' });   // en-tête + 3 blocs : occupe exactement l'écran
  page.appendChild(fit);

  // Header compact (nom modifiable, ancienneté, rouage Options)
  const editBtn = el('button', { class: 'btn ghost sm', 'aria-label': 'Modifier le nom', onclick: async () => {
    const name = prompt('Ton nom :', p.name);
    if (name && name.trim()) { p.name = name.trim(); await dbPut('profile', p); await loadAll(); render(); }
  }, html: iconHtml('pencil') });
  fit.appendChild(el('div', { class: 'header home-head flex between' }, [
    el('div', {}, [
      el('div', { class: 'dim text-xs home-since' }, greeting()),
      el('div', { class: 'text-xl home-name' }, p.name)
    ]),
    el('div', { class: 'flex gap-2' }, [editBtn, el('button', { class: 'btn ghost sm', 'aria-label': 'Options', onclick: () => navigate('options'), html: iconHtml('gear') })])
  ]));

  // Deux blocs côte à côte : niveau (dégradé) et prochaine échéance, puis le graphique en dessous.
  const top = el('div', { class: 'home-top' + (gamifyOn() ? '' : ' no-gam') });
  fit.appendChild(top);

  const card = (cls, label, right, big, pct, sub1, sub2) => el('div', { class: `card hm-card ${cls}`, html: `
    <div class="hm-label hm-label-row"><span>${label}</span><span>${right}</span></div>
    <div class="hm-big">${big}</div>
    <div class="hm-meter">${progressBar(pct, 8)}</div>
    <div class="hm-subs"><div class="hm-sub">${sub1}</div><div class="hm-sub mute">${sub2}</div></div>` });

  const gam = gamifyOn();   // gamification désactivée : ni niveau ni toile, seulement l'échéance et les barres de compétences
  if (gam) top.appendChild(card('hm-level', 'Niveau', `${p.totalXp} XP`,
    `<span style="color:var(--accent)">${li.level}</span><span class="hm-of"> / ${MAX_LEVEL}</span>`, li.progress,
    li.max ? 'Niveau maximum atteint' : `${li.xpInLevel} / ${li.xpToNext} XP`,
    li.max ? '&nbsp;' : `Niv. ${li.level + 1} dans ${li.xpToNext - li.xpInLevel} XP`));

  if (nextExam) {
    const yearPct = Math.round(computeYearProgress(nextExam.date) * 100);
    const urg = nextExam.days < 30 ? '#b8453a' : nextExam.days < 90 ? '#B5703B' : nextExam.days < 180 ? '#D08A4E' : '#E3B089';
    top.appendChild(card('hm-exam', 'Échéance', `${iconHtml(nextExam.icon)} ${escapeHtml(nextExam.short)}`,
      `<span style="color:var(--accent)">${yearPct}</span><span class="hm-of"> %</span>`, yearPct / 100,
      `<span style="color:${urg};font-weight:700">J-${nextExam.days}</span> avant échéance`,
      nextExam.endDate ? new Date(nextExam.date + 'T00:00:00').getDate() + ' – ' + formatDate(nextExam.endDate) : formatDate(nextExam.date)));
  } else {
    top.firstChild?.classList.add('full');
  }

  // Caractéristiques hebdomadaires (recalculées à la clôture de chaque semaine)
  const caracsBox = el('div', { class: 'home-radar' });
  if (gam) { fit.appendChild(caracsBox); renderCaracsCard(caracsBox).catch(err => console.error('Caracs card failed', err)); }
  else { fit.classList.add('no-gam'); top.firstChild?.classList.add('full'); }

  // Travail de la semaine : heures saisies / objectif de la semaine (au-dessus des compétences)
  const weekCard = el('div', { class: 'hn-card hm-week' });
  page.appendChild(weekCard);
  if (State._weekWork) { paintWeekWork(weekCard, State._weekWork); State._weekWork = null; }   // données préchargées : posé sans délai
  else loadWeekWork().then(d => paintWeekWork(weekCard, d)).catch(err => console.error('Week bar failed', err));

  // Compétences : une carte par caractéristique, sous la toile
  const skills = el('div', { class: 'hebdo-notes home-skills' });
  page.appendChild(el('h3', { class: 'mb-3 mt-4' }, 'Compétences'));
  page.appendChild(skills);
  renderCaracPanels(skills).catch(err => console.error('Skills failed', err));

  root.appendChild(page);
}

// Barre d'avancement du travail de la semaine en cours : minutes saisies (toutes matières) sur l'objectif hebdomadaire.
// Semaine de concours (objectif nul) : pas de barre à remplir, le travail saisi est un bonus.
export async function prefetchWeekWork() { State._weekWork = await loadWeekWork(); }

async function loadWeekWork() {
  const monday = mondayOf(todayKey()), sunday = addDays(monday, 6);
  const goals = await weekGoalsFor(monday);
  const logs = (await dbAll('workLog')).filter(l => l.date >= monday && l.date <= sunday);
  const worked = logs.reduce((t, l) => t + (l.totalMinutes || 0), 0);
  const goal = Math.round(goals.total || 0);
  const rest = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).every(isRestDay);
  return { worked, goal, rest };
}

function paintWeekWork(card, { worked, goal, rest }) {
  // Même présentation qu'une boîte de compétence (en-tête + une barre), avec l'icône chronomètre.
  const head = (note) => `
    <div class="hn-head">
      <span class="hn-ico">${iconHtml('stopwatch')}</span>
      <div class="hn-title"><div class="t1"><b>Travail de la semaine</b></div></div>
      <span class="hn-note"><span class="hn-to">${note}</span></span>
    </div>`;
  const part = (ratio, val, side, off) => `
    <div class="hn-body"><div class="hn-part${off ? ' off' : ''}${ratio >= 100 ? ' full' : ''}">
      <div class="hn-line"><span class="hn-pico">${iconHtml('target')}</span><span class="hn-name">${off ? 'Pas d’objectif' : 'Objectif de la semaine'}</span></div>
      <div class="hn-bar"><div class="hn-fill" style="width:${Math.max(0, Math.min(100, ratio))}%"></div></div>
      <div class="hn-info"><span class="hn-val">${val}</span><span class="hn-sub">${side}</span></div>
    </div></div>`;
  if (rest || goal <= 0) {
    card.innerHTML = head('Repos') + part(0, worked ? formatDuration(worked) : '', worked ? 'en bonus' : '', true);
    return;
  }
  const pct = Math.round(worked / goal * 100);
  const left = Math.max(0, goal - worked);
  card.classList.toggle('done', left === 0);
  card.innerHTML = head(`${pct}%`) + part(pct, `${formatDuration(worked)} / ${formatDuration(goal)}`, left ? `Encore ${formatDuration(left)}` : 'Objectif atteint', false);
}
