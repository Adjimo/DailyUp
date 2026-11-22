// Bandeau de choix du jour, commun aux pages Planning et Aujourd'hui : ligne de semaine (‹ semaine ›) + 7 jours.
// Les deux pages utilisent exactement les mêmes boutons ; seules les règles (jours permis, pastilles) changent.
import { parseKey, addDays } from '../core/calendar.js';
import { iconHtml } from './icons.js';
import { el } from './helpers.js';

export const fmtShort = (k) => parseKey(k).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// opts : monday, selected (YYYY-MM-DD), today,
//   title (ex. « Semaine 7 »), mode (libellé de période), prevDisabled, nextDisabled,
//   onWeek(delta), onDay(dateKey), onTitle() (retour à aujourd'hui), dayDisabled(dateKey), dot(dateKey)
export function dayBar(opts) {
  const { monday, selected, today } = opts;
  const head = el('div', { class: 'pl-head' }, [
    el('button', { class: 'pl-nav', 'aria-label': 'Semaine précédente', disabled: opts.prevDisabled ? 'disabled' : null, onclick: () => opts.onWeek(-1), html: iconHtml('chevl') }),
    el('button', { type: 'button', class: 'pl-head-mid', 'aria-label': 'Revenir à aujourd’hui', onclick: () => opts.onTitle?.() }, [
      el('div', { class: 'pl-week' }, `${opts.title ? opts.title + ' · ' : ''}${fmtShort(monday)} – ${fmtShort(addDays(monday, 6))}`),
      opts.mode ? el('div', { class: 'pl-mode' }, opts.mode) : null
    ]),
    el('button', { class: 'pl-nav', 'aria-label': 'Semaine suivante', disabled: opts.nextDisabled ? 'disabled' : null, onclick: () => opts.onWeek(1), html: iconHtml('chevr') })
  ]);
  const days = el('div', { class: 'pl-days' }, LABELS.map((lab, i) => {
    const k = addDays(monday, i);
    const off = opts.dayDisabled?.(k);
    return el('button', {
      class: `pl-day${k === selected ? ' active' : ''}${k === today ? ' today' : ''}`,
      disabled: off ? 'disabled' : null,
      'aria-label': parseKey(k).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
      onclick: () => opts.onDay(k)
    }, [el('span', {}, lab), el('b', {}, String(parseKey(k).getDate())), el('i', { class: opts.dot?.(k) ? 'on' : '' })]);
  }));
  return el('div', { class: 'day-bar' }, [head, days]);
}
