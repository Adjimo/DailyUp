// Page « Nouveautés » : s'affiche une seule fois, au premier lancement après une mise à jour.
// meta `lastSeenVersion` = dernière version dont l'utilisateur a vu les nouveautés.
//  - nouvelle installation (tutoriel pas encore fait) : version mémorisée en silence, rien affiché ;
//  - version différente de APP_VERSION : la page s'ouvre (si RELEASE_NOTES correspond), puis la version est mémorisée ;
//  - même version : rien.
// À CHAQUE MISE À JOUR : changer APP_VERSION (core/state.js) ET réécrire RELEASE_NOTES ci-dessous (items courts : 1 ligne chacun).
import { APP_VERSION } from '../core/state.js';
import { dbGet, dbPut } from '../core/db.js';
import { prefsNow } from '../features/prefs.js';
import { escapeHtml, el } from '../ui/helpers.js';
import { iconHtml } from '../ui/icons.js';

export const RELEASE_NOTES = {
  version: '5.1',
  items: [
    { icon: 'chart',    title: 'Accueil',  text: 'Nouvelle barre « Travail de la semaine ».' },
    { icon: 'calendar', title: 'Planning', text: 'Correctif : « Travail personnel » devient « Temps libre ».' },
    { icon: 'calendar', title: 'Planning', text: 'Correctif : le temps libre occupe maintenant toutes les plages disponibles.' },
    { icon: 'check',    title: 'To-do',    text: 'Correctif : les cycles ne dépassent plus le poids autorisé par semaine.' },
  ],
};

// Ouvre la fenêtre ; la promesse se résout quand elle est fermée.
export function showWhatsNew(notes = RELEASE_NOTES) {
  return new Promise((resolve) => {
    const overlay = el('div', { class: 'gpx-preview-overlay' });
    const modal = el('div', { class: 'gpx-preview-modal' });
    const rows = notes.items.map(it => `
      <div class="rg-row wn-row">
        <span class="wn-ico">${iconHtml(it.icon)}</span>
        <span class="rg-reason"><b>${escapeHtml(it.title)}</b> · ${escapeHtml(it.text)}</span>
      </div>`).join('');
    modal.innerHTML = `
      <div class="gpx-preview-head">
        <div class="gpx-preview-title"><span class="gpx-preview-icon">${iconHtml('sparkles')}</span><span>Nouveautés · v${escapeHtml(notes.version)}</span></div>
        <button class="gpx-preview-close" aria-label="Fermer">${iconHtml('close')}</button>
      </div>
      <div style="padding: 16px 18px; overflow-y: auto;">
        <div class="rg-list">${rows}</div>
        <button class="btn primary sm mt-3 wn-ok" style="width:100%;">OK</button>
      </div>`;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    const close = () => { overlay.remove(); resolve(); };
    modal.querySelector('.gpx-preview-close').addEventListener('click', close);
    modal.querySelector('.wn-ok').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  });
}

// Au lancement : affiche les nouveautés si la version a changé depuis la dernière fois.
export async function showWhatsNewIfDue() {
  const seen = (await dbGet('meta', 'lastSeenVersion'))?.value || '';
  if (seen === APP_VERSION) return;
  await dbPut('meta', { key: 'lastSeenVersion', value: APP_VERSION });   // mémorisé dès l'ouverture : jamais deux fois
  if (!prefsNow().onboarded) return;                                     // nouvelle installation : le tutoriel passe d'abord
  if (RELEASE_NOTES.version !== APP_VERSION) return;                     // pas de notes pour cette version
  await showWhatsNew();
}
