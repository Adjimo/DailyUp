// Aides d'interface (éléments DOM, toasts, modales)
import { iconHtml } from './icons.js';

// Retour visuel des boutons d'action (.btn / .btn-gpx) : pastille de chargement tant que l'action async tourne (0,35 s minimum pour qu'on la voie),
// puis ✓ sur les boutons d'enregistrement ; secousse si le handler renvoie `false` (saisie invalide). Rien si le bouton a disparu (fenêtre fermée, page redessinée).
const DONE_LABEL = /enregistr|recalcul|appliqu|valid|sauvegard|rétabl|défaut/i;
function withFeedback(btn, fn, wantsDone) {
  return async function (ev) {
    if (btn.classList.contains('is-busy')) return;
    const t0 = performance.now();
    const r = fn.call(this, ev);
    const isAsync = r && typeof r.then === 'function';
    if (isAsync) btn.classList.add('is-busy');
    let res = r;
    try { res = isAsync ? await r : r; }
    finally {
      if (isAsync) {
        const wait = 350 - (performance.now() - t0);
        if (wait > 0) await new Promise(ok => setTimeout(ok, wait));
        btn.classList.remove('is-busy');
      }
    }
    if (!btn.isConnected) return;
    if (res === false) { btn.classList.add('is-shake'); setTimeout(() => btn.classList.remove('is-shake'), 450); }
    else if (wantsDone) { btn.classList.add('is-done'); setTimeout(() => btn.classList.remove('is-done'), 1100); }
  };
}

// Même retour visuel pour un bouton posé hors de el() (gabarits HTML) : onAction(bouton, handler).
export function onAction(btn, fn) {
  if (!btn) return;
  btn.addEventListener('click', withFeedback(btn, fn, DONE_LABEL.test(btn.textContent || '')));
}

// Effet d'ondulation au toucher sur tous les boutons de l'app (délégué : un seul écouteur).
export function initPressFeedback() {
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest?.('.btn, .btn-gpx');
    if (!b || b.disabled || b.classList.contains('is-busy')) return;
    const r = b.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 1.6;
    const dot = document.createElement('span');
    dot.className = 'btn-ripple';
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    b.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
  }, { passive: true });
}

export function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  const isBtn = tag === 'button' && /(^|\s)(btn|btn-gpx)(\s|$)/.test(props.class || '');
  const label = [].concat(children).filter(c => typeof c === 'string').join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.setAttribute('style', v);
    else if (k === 'onclick' && isBtn && typeof v === 'function') e.addEventListener('click', withFeedback(e, v, DONE_LABEL.test(label)));
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') e.innerHTML = v;
    else if (v !== undefined && v !== null) e.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    if (typeof c === 'string' || typeof c === 'number') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  }
  return e;
}

export function showToast(toast, duration = 2500) {
  const root = document.getElementById('toast');
  root.className = 'toast' + (toast.type === 'levelup' ? ' levelup' : '');
  root.innerHTML = `
    <div class="icon">${iconHtml(toast.icon || (toast.type === 'levelup' ? 'party' : 'sparkles'))}</div>
    <div class="body">
      <div class="title">${escapeHtml(toast.title)}</div>
      <div class="text">${escapeHtml(toast.text || '')}</div>
    </div>
  `;
  root.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => root.classList.add('hidden'), duration);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function progressBar(value, height = 10) {
  const w = Math.min(100, Math.max(0, value * 100));
  return `<div class="progress" style="height:${height}px;"><div class="fill" style="width:${w}%;"></div></div>`;
}

// Bouton d'ajout unique de l'app : pointillés cuivre + pastille « + » (celui de la to-do). À utiliser partout où l'on ajoute un élément.
export function addBtn(label, onclick, extra = '') {
  return el('button', { type: 'button', class: ('add-btn ' + extra).trim(), onclick }, [el('span', { class: 'add-plus' }, '+'), ' ' + label]);
}
