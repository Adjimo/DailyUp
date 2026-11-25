# DailyUp

PWA mobile personnelle pour la prépa MP* (et le sport, facultatif) : temps de travail par matière, XP, niveaux, quêtes hebdomadaires, malus/bonus, planning, to-do, import GPX et records. JavaScript pur (modules ES), IndexedDB, sans framework ni build. Fonctionne hors ligne.

## Deux versions, un même code
| | Administrateur | Utilisateur |
|---|---|---|
| `IS_ADMIN` (`js/core/state.js`) | `true` | `false` |
| Titre / manifest | DailyUp Administrateur | DailyUp |
| Tutoriel relançable (Options) | oui | non |

Seuls `index.html`, `manifest.json`, `js/core/state.js` (`IS_ADMIN`) et `js/pages/whatsnew.js` diffèrent. Toute modification se fait dans les deux dossiers. Les deux sont étiquetées **5.1**, sans page « Nouveautés » (désactivée).

## Lancer et publier
- Local : `python3 -m http.server 8000` puis http://localhost:8000 (les modules ES refusent `file://`).
- GitHub Pages : déposer le contenu du dossier à la racine du dépôt. Chemins relatifs, pas de build.
- À chaque livraison : changer `APP_VERSION` (`js/core/state.js`) et `VERSION` (`sw.js`) ; si un fichier JS est ajouté ou renommé, mettre à jour `ASSETS` dans `sw.js`. Si l'ancienne version reste affichée : vérifier que la dernière génération de Pages est verte, puis ouvrir l'app deux fois.

## Structure
```
index.html · style.css · sw.js · manifest.json · icons/
js/main.js        démarrage (splash, base, tutoriel)
js/core/          état, IndexedDB, dates, calendrier scolaire, XP/niveaux, date d'arrivée
js/features/      logique métier : travail, quêtes, malus, planning, to-do, GPX, records, sauvegarde, rappels
js/pages/         une page par onglet (accueil, planning, aujourd'hui, to-do, sport, stats, options) + tutoriel
js/ui/            helpers DOM (`el`, toasts), routeur, icônes SVG, widgets
```
Dépendances : `pages` → `features`/`ui`/`core` ; `features` → `core` ; `core` n'importe rien d'autre.

## Règles à connaître
- **Objectifs** : temps libre (réveil → fin de travail, par jour) × part travaillée ; parts par matière toujours renormalisées à 100 % (`pages/caracs-settings.js`).
- **Malus** (`features/penalties.js`) : paliers selon le ratio objectif atteint (10 / 20 / 40 / 60 / 80 %). Sport (sorties) plafonné à **20 %**. Total des malus de la semaine plafonné à 100 %. Une semaine peut être justifiée (excuse).
- **Calendrier** (`core/calendar.js`) : zone B, année 2026-2027 ; vacances, révisions, concours (repos), mode allégé. Les semaines « de cours » = lundi-vendredi sans vacances ni férié, hors révisions/concours.
- **Stats** : période = arrivée dans l'app (`core/join.js`, ou première saisie si plus ancienne), jamais avant le **15 août** (`STATS_FLOOR` dans `pages/stats.js`, à changer chaque année).
- **Sport** : facultatif (réglage Options) ; un seul bouton « + Sortie » → import GPX ou saisie manuelle.
- **Boutons** : `el()` ajoute un retour visuel aux `.btn` (chargement, ✓, secousse). Un handler qui refuse une saisie doit `return false`. Hors `el()` : `onAction(bouton, handler)`.
- **Données** : uniquement dans le navigateur (IndexedDB `orion`). Sauvegarde auto quotidienne ; export/import JSON dans Options.

## Vérifier après une modif
1. `node --input-type=module --check < fichier.js` sur chaque JS touché.
2. Parcourir les 7 onglets en clair et en sombre, sans erreur console.
3. Tester sport désactivé et gamification désactivée.
