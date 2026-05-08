// ── DATA ──────────────────────────────────────────────────────────────────────
let baseRoadmap = null;
let roadmap = null;
let custom = { courses: {}, steps: {} };
let progress = { progress: {}, notes: {}, completedCourses: {}, activity: [] };

// Tracks which step bodies are currently expanded (survives re-renders)
const openSteps = new Set();

const COLORS = {
  blue:   { text: 'var(--blue)',   bg: 'bg-blue',   dot: 'dot-blue',   fill: 'fill-blue' },
  teal:   { text: 'var(--teal)',   bg: 'bg-teal',   dot: 'dot-teal',   fill: 'fill-teal' },
  amber:  { text: 'var(--amber)',  bg: 'bg-amber',  dot: 'dot-amber',  fill: 'fill-amber' },
  purple: { text: 'var(--purple)', bg: 'bg-purple', dot: 'dot-purple', fill: 'fill-purple' }
};

// ── CUSTOM COLOR HELPERS ──────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Injects a <style> block and registers the color in COLORS so all renderers work.
function registerCustomColor(key, hex) {
  if (COLORS[key]) return;
  const styleId = 'cc-' + key;
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = `
      .c-${key}    { color: ${hex}; }
      .bg-${key}   { background: ${hexToRgba(hex, 0.08)}; border-color: ${hexToRgba(hex, 0.2)} !important; }
      .dot-${key}  { background: ${hex}; border-color: ${hex}; }
      .fill-${key} { background: ${hex}; }
    `;
    document.head.appendChild(s);
  }
  COLORS[key] = { text: hex, bg: `bg-${key}`, dot: `dot-${key}`, fill: `fill-${key}` };
}

// ── SUPABASE ──────────────────────────────────────────────────────────────────
// La anon key es segura para exponer en el frontend — está diseñada para eso.
const SUPABASE_URL      = 'https://ytzcwvwrnlbamrglqijs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KN4azG8cUu6QXorUReGhkw_6l9O_3q1';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── STORAGE ───────────────────────────────────────────────────────────────────
async function saveToDb(key, data) {
  try {
    await db.from('user_data').upsert({ key, value: data });
  } catch(e) {
    console.error(`Error guardando ${key}:`, e);
  }
}

// Debounced: rapid successive toggles produce a single write after 300 ms
let _saveProgressTimer;
function saveProgress() {
  clearTimeout(_saveProgressTimer);
  _saveProgressTimer = setTimeout(() => saveToDb('progress', progress), 300);
}

function saveCustom() {
  return saveToDb('custom', custom);
}

// ── ROADMAP BUILD ─────────────────────────────────────────────────────────────
// Merges baseRoadmap + custom data into the working `roadmap` object.
function buildRoadmap() {
  roadmap = JSON.parse(JSON.stringify(baseRoadmap));

  // Merge custom phases
  const customPhases = custom.phases || [];
  roadmap.phases = [...roadmap.phases, ...customPhases.map(p => ({ ...p, steps: p.steps || [] }))];

  // Register any custom colors so COLORS lookup works for all renderers
  roadmap.phases.forEach(phase => {
    if (phase.colorHex) registerCustomColor(phase.color, phase.colorHex);
  });

  roadmap.phases.forEach(phase => {
    // Merge custom steps for this phase
    const customSteps = custom.steps[String(phase.id)] || [];
    phase.steps = [...phase.steps, ...customSteps.map(s => ({ ...s, courses: s.courses || [] }))];

    // Merge custom courses into each step
    phase.steps.forEach(step => {
      const customCourses = custom.courses[step.id] || [];
      step.courses = [...(step.courses || []), ...customCourses];
    });
  });
}

// Creates view + nav DOM elements for any phase that doesn't have them yet.
function ensurePhaseViews() {
  const main = document.querySelector('.main');
  const nav  = document.querySelector('.sidebar-nav');

  roadmap.phases.forEach(phase => {
    // View container
    if (!document.getElementById(`view-phase-${phase.id}`)) {
      const view = document.createElement('div');
      view.className = 'view';
      view.id = `view-phase-${phase.id}`;
      view.innerHTML = `<div id="phase-content-${phase.id}"></div>`;
      main.appendChild(view);
    }

    // Sidebar nav item
    if (!document.getElementById(`nav-phase-${phase.id}`)) {
      const item = document.createElement('div');
      item.className = 'nav-item';
      item.id = `nav-phase-${phase.id}`;
      item.setAttribute('onclick', `showPhase(${phase.id})`);
      item.innerHTML = `
        <span class="nav-dot dot-${phase.color}"></span>
        <span style="font-size:12px">Fase ${phase.id} · ${phase.title}</span>
        <span class="nav-progress" id="nav-pct-${phase.id}">0%</span>`;
      nav.appendChild(item);
    }
  });
}

function getPhaseHours(phase) {
  const total = phase.steps.reduce((sum, step) =>
    sum + step.courses.reduce((s, c) => s + (Number(c.hours) || 0), 0), 0);
  return total > 0 ? total : phase.hours;
}

// ── LOAD ──────────────────────────────────────────────────────────────────────
async function loadRoadmap() {
  try {
    const [roadmapRes, dbRes] = await Promise.all([
      fetch('data/roadmap.json'),
      db.from('user_data').select('key, value').in('key', ['progress', 'custom'])
    ]);
    baseRoadmap = await roadmapRes.json();

    const rows        = dbRes.data || [];
    const progressRow = rows.find(r => r.key === 'progress');
    const customRow   = rows.find(r => r.key === 'custom');
    if (progressRow?.value) progress = progressRow.value;
    if (customRow?.value)   custom   = customRow.value;
  } catch(e) {
    baseRoadmap = { phases: [] };
  }
  // Guarantee all fields exist regardless of what the file contains
  if (!custom.courses)          custom.courses  = {};
  if (!custom.steps)            custom.steps    = {};
  if (!custom.phases)           custom.phases   = [];
  if (!progress.progress)       progress.progress        = {};
  if (!progress.notes)          progress.notes           = {};
  if (!progress.completedCourses) progress.completedCourses = {};
  if (!progress.activity)       progress.activity        = [];

  buildRoadmap();
  renderAll();
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function renderAll() {
  if (!roadmap) return;
  ensurePhaseViews();
  renderDashboard();
  renderRoadmap();
  roadmap.phases.forEach(p => renderPhase(p));
  updateStats();
}

function renderDashboard() {
  // Phase progress rows — clickable (feature 1)
  const container = document.getElementById('phase-progress-rows');
  container.innerHTML = '';
  roadmap.phases.forEach(phase => {
    const pct = getPhasePercent(phase);
    const c = COLORS[phase.color];
    container.innerHTML += `
      <div class="phase-progress-row clickable" onclick="showPhase(${phase.id})" title="Ir a Fase ${phase.id}">
        <div class="phase-progress-name" style="color:${c.text}">Fase ${phase.id}: ${phase.title}</div>
        <div class="phase-progress-bar-wrap">
          <div class="phase-progress-fill ${c.fill}" style="width:${pct}%"></div>
        </div>
        <div class="phase-progress-pct">${Math.round(pct)}%</div>
        <div class="phase-progress-arrow">→</div>
      </div>`;
  });

  // Activity log
  const alog = document.getElementById('activity-log');
  if (!progress.activity || progress.activity.length === 0) {
    alog.innerHTML = '<div class="activity-empty">Aún no hay actividad registrada. ¡Empieza marcando tu primer paso!</div>';
  } else {
    alog.innerHTML = progress.activity.slice(-10).reverse().map(a => `
      <div class="activity-item">
        <div class="activity-dot"></div>
        <div class="activity-text">${a.text}</div>
        <div class="activity-date">${a.date}</div>
      </div>`).join('');
  }
}

function renderRoadmap() {
  const tl = document.getElementById('roadmap-timeline');
  let html = '<div class="timeline-line"></div>';
  roadmap.phases.forEach(phase => {
    const pct = Math.round(getPhasePercent(phase));
    const c = COLORS[phase.color];
    const stepsHtml = phase.steps.map(s => {
      const done = !!progress.progress[s.id];
      return `<span class="step-pill ${done ? 'done' : ''}" onclick="showPhase(${phase.id})">${s.title.replace(/^(Semana|Mes)\s[\d–]+:\s/, '')}</span>`;
    }).join('');
    html += `
      <div class="timeline-phase">
        <div class="timeline-dot ${c.dot}"></div>
        <div class="phase-mini-card" onclick="showPhase(${phase.id})">
          <div class="phase-mini-header">
            <span class="phase-num">FASE ${phase.id}</span>
            <span class="phase-mini-title" style="color:${c.text}">${phase.title}</span>
            <span class="phase-mini-months">${phase.months} · ${getPhaseHours(phase)}h</span>
          </div>
          <div style="font-size:12px;color:var(--muted);line-height:1.55">${phase.goal.substring(0, 120)}...</div>
          <div class="phase-mini-bar"><div class="phase-mini-fill ${c.fill}" style="width:${pct}%"></div></div>
          <div class="phase-steps-preview">${stepsHtml}</div>
        </div>
      </div>`;
  });
  tl.innerHTML = html;
}

function renderPhase(phase) {
  const c = COLORS[phase.color];
  const pct = Math.round(getPhasePercent(phase));
  const hours = getPhaseHours(phase);
  let stepsHtml = '';

  phase.steps.forEach(step => {
    const done = !!progress.progress[step.id];
    const noteVal = (progress.notes && progress.notes[step.id]) || '';
    const safeId = step.id.replace(/-/g, '_');

    const coursesHtml = step.courses.map(course => {
      const courseKey = `${step.id}__${course.name}`;
      const safeKey = courseKey.replace(/[^a-zA-Z0-9]/g, '_');
      const courseDone = !!(progress.completedCourses && progress.completedCourses[courseKey]);
      return `
        <div class="course-card ${courseDone ? 'done' : ''}" id="cc-${safeKey}">
          <div class="course-check ${courseDone ? 'done' : ''}"
               onclick="toggleCourse(event,'${step.id}','${course.name.replace(/'/g, "\\'")}',${phase.id})">
            ${courseDone ? '✓' : ''}
          </div>
          <div class="course-info">
            <div class="course-name">
              ${course.name}
              ${course._custom ? '<span class="badge-custom">personalizado</span>' : ''}
            </div>
            <div class="course-meta">
              ${course.platform ? `<span class="course-platform">${course.platform}</span>` : ''}
              ${course.author   ? `<span class="course-author">· ${course.author}</span>` : ''}
              ${course.hours    ? `<span class="course-hours">${course.hours}h</span>` : ''}
              ${course.free     ? '<span class="badge-free">GRATIS</span>' : ''}
            </div>
          </div>
          ${course.url
            ? `<a class="course-link" href="${course.url}" target="_blank" onclick="event.stopPropagation()">↗ Abrir</a>`
            : ''}
        </div>`;
    }).join('');

    stepsHtml += `
      <div class="step-card ${done ? 'done' : ''}" id="step-card-${safeId}">
        <div class="step-header" onclick="toggleStepBody('${step.id}')">
          <div class="step-check ${done ? 'done' : ''}"
               onclick="toggleStep(event,'${step.id}',${phase.id})">
            ${done ? '✓' : ''}
          </div>
          <div class="step-title-wrap">
            <div class="step-title">${step.title}</div>
            ${done ? '<div class="step-done-label">✓ Completado</div>' : ''}
          </div>
          <span class="step-chevron" id="chev-${safeId}">▶</span>
        </div>
        <div class="step-body" id="body-${safeId}">
          ${step.detail ? `<div class="step-detail">${step.detail}</div>` : ''}
          <div class="courses-label">Cursos y recursos</div>
          <div class="courses-grid">
            ${coursesHtml}
            <div class="add-course-trigger">
              <button class="btn-add-inline" onclick="toggleAddCourseForm('${step.id}',${phase.id})">
                ＋ Agregar curso
              </button>
              <div class="inline-form" id="course-form-${safeId}" style="display:none">
                <div class="form-grid">
                  <input class="form-input form-input--wide" placeholder="Nombre del curso *"  id="cf-name-${safeId}">
                  <input class="form-input"                  placeholder="Plataforma"           id="cf-platform-${safeId}">
                  <input class="form-input"                  placeholder="Autor"                id="cf-author-${safeId}">
                  <input class="form-input form-input--sm"   placeholder="Horas" type="number" min="0" id="cf-hours-${safeId}">
                  <input class="form-input form-input--wide" placeholder="URL (opcional)"       id="cf-url-${safeId}">
                  <label class="form-check-label">
                    <input type="checkbox" id="cf-free-${safeId}"> Gratis
                  </label>
                </div>
                <div class="form-actions">
                  <button class="btn-submit" onclick="submitCustomCourse('${step.id}',${phase.id})">Guardar</button>
                  <button class="btn-cancel" onclick="toggleAddCourseForm('${step.id}',${phase.id})">Cancelar</button>
                </div>
              </div>
            </div>
          </div>
          <div class="notes-section">
            <div class="notes-label">Mis notas</div>
            <textarea class="notes-textarea" id="note-${safeId}"
              placeholder="Escribe tus notas, aprendizajes o comentarios..."
              oninput="markNoteDirty('${step.id}')">${noteVal}</textarea>
            <button class="save-note-btn" id="note-btn-${safeId}" onclick="saveNote('${step.id}')">
              Guardar nota
            </button>
          </div>
        </div>
      </div>`;
  });

  document.getElementById(`phase-content-${phase.id}`).innerHTML = `
    <div class="phase-banner bg-${phase.color}">
      <div class="phase-months">${phase.months}</div>
      <h2 class="c-${phase.color}">${phase.title}</h2>
      <p class="phase-goal">${phase.goal}</p>
      <div class="phase-meta">
        <span class="phase-chip">${hours}h estimadas</span>
        <span class="phase-chip">${phase.steps.length} pasos</span>
        <span class="phase-chip">${pct}% completado</span>
      </div>
    </div>
    <div class="steps-list">${stepsHtml}</div>
    <div class="add-step-section">
      <button class="btn-add-step" onclick="toggleAddStepForm(${phase.id})">Agregar paso a esta fase</button>
      <div class="inline-form" id="step-form-${phase.id}" style="display:none">
        <div class="form-grid">
          <input class="form-input form-input--wide" placeholder="Título del paso *" id="sf-title-${phase.id}">
          <textarea class="form-input form-textarea" placeholder="Descripción del paso (opcional)" id="sf-detail-${phase.id}"></textarea>
        </div>
        <div class="form-actions">
          <button class="btn-submit" onclick="submitCustomStep(${phase.id})">Guardar paso</button>
          <button class="btn-cancel" onclick="toggleAddStepForm(${phase.id})">Cancelar</button>
        </div>
      </div>
    </div>`;

  restoreOpenSteps();
}

// ── OPEN STEPS STATE ──────────────────────────────────────────────────────────
function restoreOpenSteps() {
  openSteps.forEach(stepId => {
    const id = stepId.replace(/-/g, '_');
    document.getElementById('body-' + id)?.classList.add('open');
    document.getElementById('chev-' + id)?.classList.add('open');
  });
}

function toggleStepBody(stepId) {
  const id = stepId.replace(/-/g, '_');
  const body = document.getElementById('body-' + id);
  const chev = document.getElementById('chev-' + id);
  if (!body) return;
  const open = body.classList.contains('open');
  if (open) openSteps.delete(stepId);
  else openSteps.add(stepId);
  body.classList.toggle('open', !open);
  chev.classList.toggle('open', !open);
}

// ── INTERACTIONS ──────────────────────────────────────────────────────────────
function toggleStep(event, stepId, phaseId) {
  event.stopPropagation();
  const was = !!progress.progress[stepId];
  const nowDone = !was;

  // Immediate visual feedback — update DOM before re-render
  const safeId = stepId.replace(/-/g, '_');
  const card    = document.getElementById('step-card-' + safeId);
  const check   = card?.querySelector('.step-check');
  const label   = card?.querySelector('.step-done-label');
  if (check) {
    check.classList.toggle('done', nowDone);
    check.textContent = nowDone ? '✓' : '';
  }
  if (card) card.classList.toggle('done', nowDone);

  progress.progress[stepId] = nowDone;
  const phase = roadmap.phases.find(p => p.id === phaseId);
  const step  = phase && phase.steps.find(s => s.id === stepId);
  if (nowDone && step) addActivity(`Completaste: ${step.title.replace(/^(Semana|Mes)\s[\d–]+:\s/, '')}`);
  saveProgress();
  if (phase) renderPhase(phase);
  updateStats();
  renderDashboard();
  renderRoadmap();
  showToast(nowDone ? '✓ Paso completado' : 'Paso desmarcado');
}

function toggleCourse(event, stepId, courseName, phaseId) {
  event.stopPropagation();
  const key    = `${stepId}__${courseName}`;
  const safeKey = key.replace(/[^a-zA-Z0-9]/g, '_');
  const was    = !!(progress.completedCourses && progress.completedCourses[key]);
  const nowDone = !was;

  // Immediate visual feedback
  const card  = document.getElementById('cc-' + safeKey);
  const check = card?.querySelector('.course-check');
  if (check) {
    check.classList.toggle('done', nowDone);
    check.textContent = nowDone ? '✓' : '';
  }
  if (card) card.classList.toggle('done', nowDone);

  if (!progress.completedCourses) progress.completedCourses = {};
  progress.completedCourses[key] = nowDone;
  if (nowDone) addActivity(`Curso completado: ${courseName}`);
  saveProgress();
  const phase = roadmap.phases.find(p => p.id === phaseId);
  if (phase) renderPhase(phase);
  updateStats();
  renderDashboard();
  showToast(nowDone ? '✓ Curso completado' : 'Curso desmarcado');
}

function saveNote(stepId) {
  const id  = stepId.replace(/-/g, '_');
  const val = document.getElementById('note-' + id)?.value || '';
  if (!progress.notes) progress.notes = {};
  progress.notes[stepId] = val;
  saveProgress();
  const btn = document.getElementById('note-btn-' + id);
  if (btn) btn.textContent = 'Guardar nota';
  showToast('Nota guardada');
}

function markNoteDirty(stepId) {
  const id  = stepId.replace(/-/g, '_');
  const btn = document.getElementById('note-btn-' + id);
  if (btn && btn.textContent === 'Guardar nota') btn.textContent = 'Guardar nota •';
}

function addActivity(text) {
  if (!progress.activity) progress.activity = [];
  const date = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  progress.activity.push({ text, date });
  if (progress.activity.length > 50) progress.activity = progress.activity.slice(-50);
}

// ── CUSTOM COURSES ────────────────────────────────────────────────────────────
function toggleAddCourseForm(stepId) {
  const safeId = stepId.replace(/-/g, '_');
  const form   = document.getElementById('course-form-' + safeId);
  if (!form) return;
  const visible = form.style.display !== 'none';
  form.style.display = visible ? 'none' : 'block';
  if (!visible) form.querySelector('input')?.focus();
}

async function submitCustomCourse(stepId, phaseId) {
  const safeId = stepId.replace(/-/g, '_');
  const name   = document.getElementById('cf-name-' + safeId)?.value.trim();
  if (!name) { showToast('El nombre es obligatorio'); return; }

  const course = {
    name,
    platform: document.getElementById('cf-platform-' + safeId)?.value.trim() || '',
    author:   document.getElementById('cf-author-'   + safeId)?.value.trim() || '',
    hours:    parseInt(document.getElementById('cf-hours-' + safeId)?.value) || 0,
    free:     document.getElementById('cf-free-'     + safeId)?.checked || false,
    url:      document.getElementById('cf-url-'      + safeId)?.value.trim() || '',
    _custom:  true
  };

  if (!custom.courses[stepId]) custom.courses[stepId] = [];
  custom.courses[stepId].push(course);

  await saveCustom();
  buildRoadmap();
  openSteps.add(stepId); // keep the step open after re-render
  const phase = roadmap.phases.find(p => p.id === phaseId);
  if (phase) renderPhase(phase);
  updateStats();
  renderDashboard();
  renderRoadmap();
  showToast('Curso agregado');
}

// ── CUSTOM STEPS ──────────────────────────────────────────────────────────────
function toggleAddStepForm(phaseId) {
  const form = document.getElementById('step-form-' + phaseId);
  if (!form) return;
  const visible = form.style.display !== 'none';
  form.style.display = visible ? 'none' : 'block';
  if (!visible) form.querySelector('input')?.focus();
}

async function submitCustomStep(phaseId) {
  const title  = document.getElementById('sf-title-'  + phaseId)?.value.trim();
  if (!title) { showToast('El título es obligatorio'); return; }

  const detail = document.getElementById('sf-detail-' + phaseId)?.value.trim() || '';
  const stepId = `custom-p${phaseId}-${Date.now()}`;

  const step = { id: stepId, title, detail, courses: [], _custom: true };

  if (!custom.steps[String(phaseId)]) custom.steps[String(phaseId)] = [];
  custom.steps[String(phaseId)].push(step);

  await saveCustom();
  buildRoadmap();
  const phase = roadmap.phases.find(p => p.id === phaseId);
  if (phase) renderPhase(phase);
  updateStats();
  renderDashboard();
  renderRoadmap();
  showToast('Paso agregado');
}

// ── CUSTOM PHASES ─────────────────────────────────────────────────────────────
function toggleAddPhaseForm() {
  const form = document.getElementById('phase-form');
  if (!form) return;
  const visible = form.style.display !== 'none';
  form.style.display = visible ? 'none' : 'block';
  if (!visible) document.getElementById('pf-title')?.focus();
}

function onColorRadioChange() {
  const isCustom = document.querySelector('input[name="pf-color"]:checked')?.value === 'custom';
  document.getElementById('custom-color-fields').style.display = isCustom ? 'flex' : 'none';
}

function updateCustomColorPreview() {
  const hex    = document.getElementById('pf-color-hex')?.value || '#6366f1';
  const swatch = document.getElementById('swatch-custom-preview');
  if (swatch) swatch.style.background = hex;
}

async function submitCustomPhase() {
  const title = document.getElementById('pf-title')?.value.trim();
  if (!title) { showToast('El título es obligatorio'); return; }

  const newId     = Math.max(...roadmap.phases.map(p => Number(p.id)), 4) + 1;
  const selected  = document.querySelector('input[name="pf-color"]:checked')?.value || 'blue';

  let color, colorHex;
  if (selected === 'custom') {
    colorHex       = document.getElementById('pf-color-hex')?.value || '#6366f1';
    const rawName  = document.getElementById('pf-color-name')?.value.trim();
    color          = rawName
      ? rawName.toLowerCase().replace(/[^a-z0-9]/g, '')
      : 'c' + colorHex.slice(1);
    registerCustomColor(color, colorHex);
  } else {
    color    = selected;
    colorHex = null;
  }

  const phase = {
    id:      newId,
    title,
    months:  document.getElementById('pf-months')?.value.trim() || '',
    hours:   parseInt(document.getElementById('pf-hours')?.value) || 0,
    goal:    document.getElementById('pf-goal')?.value.trim() || '',
    color,
    ...(colorHex && { colorHex }),
    steps:   [],
    _custom: true
  };

  if (!custom.phases) custom.phases = [];
  custom.phases.push(phase);

  await saveCustom();
  buildRoadmap();
  ensurePhaseViews();
  renderPhase(roadmap.phases.find(p => p.id === newId));
  renderRoadmap();
  renderDashboard();
  updateStats();

  // Reset form
  ['pf-title','pf-months','pf-hours','pf-goal','pf-color-name'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const hexEl = document.getElementById('pf-color-hex');
  if (hexEl) hexEl.value = '#6366f1';
  document.querySelector('input[name="pf-color"][value="blue"]').checked = true;
  document.getElementById('custom-color-fields').style.display = 'none';
  toggleAddPhaseForm();

  showToast(`Fase ${newId} creada`);
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function getPhasePercent(phase) {
  if (!phase.steps.length) return 0;
  const done = phase.steps.filter(s => progress.progress && progress.progress[s.id]).length;
  return (done / phase.steps.length) * 100;
}

function updateStats() {
  let totalSteps = 0, doneSteps = 0;
  let totalCourses = 0, doneCourses = 0;

  roadmap.phases.forEach(phase => {
    const pct = Math.round(getPhasePercent(phase));
    const navPct = document.getElementById(`nav-pct-${phase.id}`);
    if (navPct) navPct.textContent = pct + '%';
    phase.steps.forEach(step => {
      totalSteps++;
      if (progress.progress && progress.progress[step.id]) doneSteps++;
      step.courses.forEach(course => {
        totalCourses++;
        if (progress.completedCourses && progress.completedCourses[`${step.id}__${course.name}`]) doneCourses++;
      });
    });
  });

  const totalPct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  document.getElementById('stat-total').textContent   = totalPct + '%';
  document.getElementById('stat-steps').textContent   = `${doneSteps} / ${totalSteps}`;
  document.getElementById('stat-courses').textContent = `${doneCourses} / ${totalCourses}`;
  document.getElementById('d-total').textContent      = totalPct + '%';
  document.getElementById('d-steps').textContent      = doneSteps;
  document.getElementById('d-courses').textContent    = doneCourses;

  const activePhase = roadmap.phases.find(p => getPhasePercent(p) < 100);
  document.getElementById('d-streak').textContent = activePhase ? `Fase ${activePhase.id}` : '¡Listo!';
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + viewId)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') === `showView('${viewId}')`) n.classList.add('active');
  });
}

function showPhase(phaseId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-phase-${phaseId}`)?.classList.add('active');
  document.getElementById(`nav-phase-${phaseId}`)?.classList.add('active');
  document.querySelector('.main')?.scrollTo(0, 0);
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
loadRoadmap();
