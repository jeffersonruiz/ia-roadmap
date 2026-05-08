# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start      # Start local server at http://localhost:3000
npm run dev    # Alias for start
```

No build, lint, or test commands exist. `server.js` is for local development only — production runs on GitHub Pages + Supabase.

## Architecture

Single-page app with no framework and no bundler. External dependency: Supabase JS SDK loaded via CDN.

```
server.js           — Node.js HTTP server (port 3000, built-in modules only) — dev only
index.html          — HTML structure only (165 lines); loads Supabase CDN, style.css, app.js
style.css           — All CSS (dark theme, CSS custom properties, grid layout)
app.js              — All JS logic (~664 lines); includes Supabase client setup
data/roadmap.json   — Base curriculum content (phases, steps, courses) — read-only at runtime
data/custom.json    — Not used in production; legacy dev artifact
data/progress.json  — Not used in production; legacy dev artifact
```

### Data flow

1. `server.js` serves static files locally (dev only). No custom API endpoints.
2. On page load, `loadRoadmap()` runs two fetches in parallel:
   - `fetch('data/roadmap.json')` — base curriculum (static file)
   - `db.from('user_data').select('key, value').in('key', ['progress', 'custom'])` — user state from Supabase
3. `buildRoadmap()` merges `baseRoadmap` + `custom` into the working `roadmap` object (custom phases/steps/courses are appended).
4. `renderAll()` populates the Dashboard, timeline, and all phase detail views.
5. User interactions call `saveProgress()` or `saveCustom()` → `saveToDb(key, data)` → Supabase `user_data` table.

### app.js structure

| Function | Purpose |
|---|---|
| `buildRoadmap()` | Merges base JSON + custom data into working `roadmap` |
| `ensurePhaseViews()` | Creates sidebar nav + view DOM elements for any phase not in HTML |
| `loadRoadmap()` | Boot: fetch all JSON → buildRoadmap → renderAll |
| `renderAll()` | Triggers all view renders + stats update |
| `renderDashboard()` | Phase progress rows (clickable) + activity log |
| `renderRoadmap()` | Timeline view across all phases |
| `renderPhase(phase)` | Detail view: steps, courses, notes, add-course/step forms |
| `toggleStep()` / `toggleCourse()` | Mark complete with immediate DOM feedback before re-render |
| `saveToDb(key, data)` | Upsert `progress` or `custom` row in Supabase `user_data` table |
| `submitCustomPhase/Step/Course()` | Persist user-added content via `saveCustom()` → Supabase |

### roadmap.json schema

Each phase requires `id` (number), `color` (string: `"blue"`, `"teal"`, `"amber"`, or `"purple"`), `title`, `months`, `hours`, `goal`, and `steps`. Each step requires `id` (string, e.g. `"1-1"`), `title`, and `courses`. Each course requires `name` (used as identity key for progress tracking) and optionally `platform`, `author`, `hours` (number), `free` (boolean), `url`.

**The `color` field is mandatory on every phase** — `COLORS[undefined]` crashes the renderer.

### Color system

Four named colors: `blue`, `teal`, `amber`, `purple`. CSS classes follow the pattern `bg-{color}`, `c-{color}`, `dot-{color}`, `fill-{color}`. Custom colors can be registered at runtime via `registerCustomColor(key, hex)`, which injects a `<style>` block and adds the entry to `COLORS`.

### Phases beyond 4

The HTML pre-renders views for phases 1–4. `ensurePhaseViews()` dynamically creates view containers and sidebar nav items for any additional phases from the JSON (e.g. phase 5).

### State objects

```js
progress = { progress: {}, notes: {}, completedCourses: {}, activity: [] }
custom   = { phases: [], steps: {}, courses: {} }
```

`progress.progress[stepId]` is a boolean. `progress.completedCourses["{stepId}__{courseName}"]` is a boolean. `custom.steps` and `custom.courses` are keyed by phase id and step id respectively.

### Supabase

**Production hosting:** GitHub Pages (static files) + Supabase (user data).

**Required table:**

```sql
create table user_data (
  key   text primary key,
  value jsonb not null default '{}'
);
```

Two rows are expected: `key = 'progress'` and `key = 'custom'`. Values match the `progress` and `custom` state objects above.

**Client setup in `app.js`:**

```js
const SUPABASE_URL  = '...'
const SUPABASE_ANON_KEY = '...'
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

`SUPABASE_ANON_KEY` is safe to expose publicly — it is the Supabase anon/public key, which is subject to row-level security policies on the database side.

**Script load order in `index.html`:**

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="app.js"></script>
```
