// Script Liner — app.js

// ============================================================
// STATE
// ============================================================
const state = {
  script: null,
  slates: [],
  activeSlateId: null,
  activeCameraId: null,
  lineType: 'squiggly',
  addingLine: false,
  lineStartId: null,
  selectedLineId: null,
  extendMode: null, // 'start' | 'end'
};

const CAMERA_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
  '#00bcd4', '#ff5722',
];
let colorIndex = 0;

// ============================================================
// ANCHOR HELPERS
// ============================================================
function makeAnchor(elem, currentScene) {
  // scene:type:text — unique enough to survive paragraph reordering/additions
  const scene = elem.sceneNumber || currentScene || '0';
  return `${scene}:${elem.type}:${elem.text.slice(0, 80)}`;
}

function enrichWithAnchors(elements) {
  let currentScene = '0';
  const counts = {};
  for (const e of elements) {
    if (e.type === 'Scene Heading') currentScene = e.sceneNumber || currentScene;
    const base = `${currentScene}:${e.type}:${e.text.slice(0, 80)}`;
    counts[base] = (counts[base] || 0) + 1;
    // Append occurrence number for duplicates (e.g. SARAH appears multiple times)
    e.anchor = counts[base] === 1 ? base : `${base}:${counts[base]}`;
  }
}

function buildAnchorMap(elements) {
  // anchor string → element id
  const map = {};
  for (const e of elements) {
    if (e.anchor) map[e.anchor] = e.id;
  }
  return map;
}

function resolveAnchor(anchor, anchorMap) {
  // Returns element id or null
  if (anchor == null) return null;
  if (typeof anchor === 'number') return anchor; // legacy numeric id
  return anchorMap[anchor] ?? null;
}

// ============================================================
// FDX PARSER
// ============================================================
function parseFDX(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  if (doc.querySelector('parsererror')) throw new Error('Invalid FDX file — is this a Final Draft .fdx file?');

  let title = 'Untitled Script';
  const titleText = doc.querySelector('TitlePage Content Paragraph Text');
  if (titleText && titleText.textContent.trim()) title = titleText.textContent.trim();

  const paragraphs = Array.from(doc.querySelectorAll('Content > Paragraph'));
  const elements = [];
  let autoScene = 0;

  for (const para of paragraphs) {
    const type = para.getAttribute('Type') || '';
    const text = Array.from(para.querySelectorAll('Text')).map(t => t.textContent).join('').trim();
    if (!text) continue;

    const elem = { id: elements.length, type, text };

    if (type === 'Scene Heading') {
      autoScene++;
      const props = para.querySelector('SceneProperties');
      elem.sceneNumber = props ? (props.getAttribute('Number') || String(autoScene)) : String(autoScene);
    }

    if (type === 'Character') {
      elem.characterName = text.replace(/\s*\([^)]*\)\s*/g, '').trim().toUpperCase();
    }

    // Stable anchor: sceneN:type:text (survives script edits as long as the line exists)
    elem.anchor = makeAnchor(elem, String(autoScene));

    elements.push(elem);
  }

  if (elements.length === 0) throw new Error('No script content found in this file.');
  enrichWithAnchors(elements);
  return { title, elements };
}

// ============================================================
// DEMO SCRIPT
// ============================================================
function getDemoScript() {
  const script = {
    title: 'The Meeting (Demo)',
    elements: [
      { id: 0, type: 'Scene Heading', text: 'INT. COFFEE SHOP - DAY', sceneNumber: '1' },
      { id: 1, type: 'Action', text: 'A busy morning coffee shop. JOHN (30s, tired eyes) enters, scanning the room.' },
      { id: 2, type: 'Character', text: 'SARAH', characterName: 'SARAH' },
      { id: 3, type: 'Dialogue', text: "You're late. Again." },
      { id: 4, type: 'Character', text: 'JOHN', characterName: 'JOHN' },
      { id: 5, type: 'Parenthetical', text: '(sitting down)' },
      { id: 6, type: 'Dialogue', text: 'Traffic was a nightmare. Sorry.' },
      { id: 7, type: 'Character', text: 'SARAH', characterName: 'SARAH' },
      { id: 8, type: 'Dialogue', text: "I ordered for you. It's probably cold by now." },
      { id: 9, type: 'Action', text: 'John wraps both hands around the mug. Grateful anyway.' },
      { id: 10, type: 'Character', text: 'JOHN', characterName: 'JOHN' },
      { id: 11, type: 'Dialogue', text: "Still perfect. Now — what couldn't wait?" },
      { id: 12, type: 'Action', text: 'Sarah leans forward. Lowers her voice.' },
      { id: 13, type: 'Scene Heading', text: 'INT. COFFEE SHOP - CONTINUOUS', sceneNumber: '2' },
      { id: 14, type: 'Action', text: 'The background noise seems to fade as the two of them lock eyes.' },
      { id: 15, type: 'Character', text: 'SARAH', characterName: 'SARAH' },
      { id: 16, type: 'Dialogue', text: "They know about the file." },
      { id: 17, type: 'Character', text: 'JOHN', characterName: 'JOHN' },
      { id: 18, type: 'Parenthetical', text: '(barely a whisper)' },
      { id: 19, type: 'Dialogue', text: 'All of it?' },
      { id: 20, type: 'Character', text: 'SARAH', characterName: 'SARAH' },
      { id: 21, type: 'Dialogue', text: 'Enough.' },
      { id: 22, type: 'Action', text: 'Sarah slides an envelope across the table and stands to leave.' },
      { id: 23, type: 'Character', text: 'JOHN', characterName: 'JOHN' },
      { id: 24, type: 'Dialogue', text: "Sarah —" },
      { id: 25, type: 'Action', text: "She's already gone." },
      { id: 26, type: 'Transition', text: 'CUT TO:' },
      { id: 27, type: 'Scene Heading', text: 'EXT. COFFEE SHOP - MOMENTS LATER', sceneNumber: '3' },
      { id: 28, type: 'Action', text: 'John bursts through the door, envelope in hand. The street is empty.' },
    ]
  };
  enrichWithAnchors(script.elements);
  return script;
}

// ============================================================
// SCRIPT RENDERER
// ============================================================
function renderScript(script) {
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('scroll-container').style.display = '';
  const container = document.getElementById('script-content');
  container.innerHTML = '';

  for (const elem of script.elements) {
    const div = document.createElement('div');
    div.dataset.id = elem.id;
    div.dataset.type = elem.type;

    switch (elem.type) {
      case 'Scene Heading':
        div.className = 'elem elem-scene';
        div.innerHTML = `<span class="scene-num">${esc(elem.sceneNumber)}.</span>${esc(elem.text)}`;
        break;
      case 'Action':
        div.className = 'elem elem-action';
        div.textContent = elem.text;
        break;
      case 'Character':
        div.className = 'elem elem-character';
        div.textContent = elem.text;
        break;
      case 'Dialogue':
        div.className = 'elem elem-dialogue';
        div.textContent = elem.text;
        break;
      case 'Parenthetical':
        div.className = 'elem elem-paren';
        div.textContent = elem.text;
        break;
      case 'Transition':
        div.className = 'elem elem-transition';
        div.textContent = elem.text;
        break;
      default:
        div.className = 'elem elem-other';
        div.textContent = elem.text;
    }

    div.addEventListener('click', () => handleElementClick(elem.id));
    container.appendChild(div);
  }
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// TRAMLINE DRAWING
// ============================================================
function getAllColumns() {
  const cols = [];
  for (const slate of state.slates) {
    for (const cam of slate.cameras) {
      cols.push({ slate, cam });
    }
  }
  return cols;
}

function drawTramlines() {
  const svg = document.getElementById('tram-svg');
  const scriptContent = document.getElementById('script-content');
  if (!svg || !scriptContent) return;

  while (svg.lastChild) svg.removeChild(svg.lastChild);

  const cols = getAllColumns();
  const colW = 26;
  const pad = 6;
  const totalW = Math.max(cols.length * colW + pad * 2, 40);
  const totalH = Math.max(scriptContent.offsetHeight, 200);

  svg.setAttribute('width', totalW);
  svg.setAttribute('height', totalH);
  svg.style.width = totalW + 'px';
  svg.style.height = totalH + 'px';
  document.getElementById('tram-panel').style.width = totalW + 'px';

  // Thin guide line down each column so empty columns are still visible
  for (let ci = 0; ci < cols.length; ci++) {
    const { cam } = cols[ci];
    const x = pad + ci * colW + colW / 2;
    const guide = svgEl('line', { x1: x, y1: 0, x2: x, y2: totalH, stroke: cam.color, 'stroke-width': '0.5', opacity: '0.15' });
    svg.appendChild(guide);
  }

  // Draw each line
  for (let ci = 0; ci < cols.length; ci++) {
    const { slate, cam } = cols[ci];
    const x = pad + ci * colW + colW / 2;
    for (const line of cam.lines) {
      drawOneLine(svg, line, cam, slate, x);
    }
  }
}

function drawOneLine(svg, line, cam, slate, x) {
  const startEl = document.querySelector(`[data-id="${line.startElementId}"]`);
  const endEl = document.querySelector(`[data-id="${line.endElementId}"]`);
  if (!startEl || !endEl) return;

  const y1 = startEl.offsetTop + 2;
  const y2 = endEl.offsetTop + endEl.offsetHeight - 2;
  if (y2 <= y1) return;

  const isSelected = state.selectedLineId === line.id;
  const sw = isSelected ? 4 : 3;
  const color = cam.color;

  if (line.onCamera) {
    const seg = svgEl('line', { x1: x, y1, x2: x, y2, stroke: color, 'stroke-width': sw, 'stroke-linecap': 'round' });
    if (isSelected) seg.setAttribute('opacity', '1');
    svg.appendChild(seg);
  } else {
    const path = svgEl('path', { d: squiggle(x, y1, y2, 5), stroke: color, 'stroke-width': sw - 1, fill: 'none', 'stroke-linecap': 'round' });
    svg.appendChild(path);
  }

  // Selection glow
  if (isSelected) {
    const glow = svgEl('rect', {
      x: x - 8, y: y1, width: 16, height: y2 - y1,
      fill: color, opacity: '0.15', rx: 3,
    });
    svg.insertBefore(glow, svg.firstChild);
  }

  // Hit area — wide for easy tapping on mobile
  const hit = svgEl('rect', { x: x - 20, y: y1, width: 40, height: y2 - y1, fill: 'transparent' });
  hit.style.cursor = 'pointer';
  hit.addEventListener('click', (e) => { e.stopPropagation(); selectLine(line.id, e); });
  svg.appendChild(hit);

  // Slate name pills at start and end — double as drag handles when selected
  drawSlatePill(svg, slate.name, x, y1, color, 'start', isSelected ? line.id : null);
  drawSlatePill(svg, slate.name, x, y2, color, 'end',   isSelected ? line.id : null);
}

function drawSlatePill(svg, label, x, y, color, position, selectedLineId) {
  const pw = label.length <= 2 ? 22 : 28;
  const ph = 13;
  const px = x - pw / 2;
  const py = position === 'start' ? y - ph : y;
  const mode = position === 'start' ? 'start' : 'end';

  const attrs = { x: px, y: py, width: pw, height: ph, rx: ph / 2, fill: color };
  if (selectedLineId) { attrs.stroke = '#fff'; attrs['stroke-width'] = 2; }
  const rect = svgEl('rect', attrs);

  if (selectedLineId) {
    rect.style.cursor = 'pointer';
    rect.addEventListener('click', (e) => {
      e.stopPropagation();
      state.extendMode = mode;
      updateLinePanel();
      showToast(`Tap element to move line ${mode}`);
    });
  }

  svg.appendChild(rect);
  const t = svgText(x, py + ph - 4, label, '#fff', '8px', 'bold');
  if (selectedLineId) t.style.pointerEvents = 'none';
  svg.appendChild(t);
}

function squiggle(x, y1, y2, amp) {
  const seg = 10;
  let d = `M ${x} ${y1}`;
  let y = y1, side = 1;
  while (y < y2) {
    const next = Math.min(y + seg / 2, y2);
    d += ` Q ${x + side * amp} ${(y + next) / 2} ${x} ${next}`;
    y = next; side = -side;
  }
  return d;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function svgText(x, y, text, color, fontSize, weight) {
  const t = svgEl('text', { x, y, 'text-anchor': 'middle', 'font-size': fontSize, 'font-family': 'system-ui, sans-serif', fill: color });
  if (weight) t.setAttribute('font-weight', weight);
  t.textContent = text;
  return t;
}

// ============================================================
// LINE INTERACTIONS
// ============================================================
function handleElementClick(elementId) {
  // Extend mode: move start or end of selected line
  if (state.extendMode && state.selectedLineId) {
    extendLine(state.selectedLineId, elementId, state.extendMode);
    state.extendMode = null;
    updateLinePanel();
    return;
  }

  // Need active camera to add lines
  if (!state.activeCameraId) {
    showToast('Select a camera in the sidebar first');
    return;
  }

  if (!state.addingLine) {
    state.addingLine = true;
    state.lineStartId = elementId;
    setElemHighlight(elementId, true);
    showToast('Now tap where the line ends');
  } else {
    const startId = state.lineStartId;
    setElemHighlight(startId, false);
    state.addingLine = false;
    state.lineStartId = null;

    if (startId === elementId) { showToast('Tap a different element for the end'); return; }

    const [s, e] = startId < elementId ? [startId, elementId] : [elementId, startId];
    addLine(s, e);
  }
}

function setElemHighlight(id, on) {
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) el.classList.toggle('elem-selecting', on);
}

function addLine(startElementId, endElementId) {
  const cam = getActiveCamera();
  if (!cam) return;
  const elems = state.script.elements;
  cam.lines.push({
    id: 'line-' + Date.now(),
    startElementId,
    endElementId,
    startAnchor: elems[startElementId]?.anchor || startElementId,
    endAnchor:   elems[endElementId]?.anchor   || endElementId,
    onCamera: state.lineType === 'straight',
  });
  drawTramlines();
  autoSave();
  showToast('Line added');
}

function getActiveCamera() {
  for (const slate of state.slates)
    for (const cam of slate.cameras)
      if (cam.id === state.activeCameraId) return cam;
  return null;
}

function selectLine(lineId, evt) {
  const wasSelected = state.selectedLineId === lineId;
  state.selectedLineId = wasSelected ? null : lineId;
  state.extendMode = null;
  drawTramlines();
  updateLinePanel();
  if (!wasSelected && evt) showLinePopup(lineId, evt);
  else hideLinePopup();
}

function showLinePopup(lineId, evt) {
  const popup = document.getElementById('line-popup');
  // Position near click, but keep within viewport
  const svgRect = document.getElementById('tram-svg').getBoundingClientRect();
  const scrollTop = document.getElementById('scroll-container').scrollTop;
  // Use clientX/Y from the event
  let x = evt.clientX + 12;
  let y = evt.clientY - 20;
  // Keep inside window
  if (x + 180 > window.innerWidth) x = evt.clientX - 190;
  if (y + 160 > window.innerHeight) y = evt.clientY - 160;
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
  popup.style.display = 'block';

  // Find line type label
  let label = '';
  for (const slate of state.slates)
    for (const cam of slate.cameras) {
      const line = cam.lines.find(l => l.id === lineId);
      if (line) label = `${cam.label} — ${line.onCamera ? 'On camera' : 'Off camera'}`;
    }
  document.getElementById('popup-label').textContent = label;
}

function hideLinePopup() {
  document.getElementById('line-popup').style.display = 'none';
}

function deleteSelectedLine() {
  if (!state.selectedLineId) return;
  for (const slate of state.slates) {
    for (const cam of slate.cameras) {
      const idx = cam.lines.findIndex(l => l.id === state.selectedLineId);
      if (idx !== -1) {
        cam.lines.splice(idx, 1);
        state.selectedLineId = null;
        hideLinePopup();
        drawTramlines();
        updateLinePanel();
        autoSave();
        return;
      }
    }
  }
}

function toggleSelectedLineType() {
  if (!state.selectedLineId) return;
  for (const slate of state.slates)
    for (const cam of slate.cameras) {
      const line = cam.lines.find(l => l.id === state.selectedLineId);
      if (line) { line.onCamera = !line.onCamera; drawTramlines(); autoSave(); return; }
    }
}

function extendLine(lineId, newElementId, mode) {
  for (const slate of state.slates)
    for (const cam of slate.cameras) {
      const line = cam.lines.find(l => l.id === lineId);
      if (!line) continue;
      const elems = state.script.elements;
      if (mode === 'start') {
        if (newElementId >= line.endElementId) { showToast('Start must be before end'); return; }
        line.startElementId = newElementId;
        line.startAnchor = elems[newElementId]?.anchor || newElementId;
      } else {
        if (newElementId <= line.startElementId) { showToast('End must be after start'); return; }
        line.endElementId = newElementId;
        line.endAnchor = elems[newElementId]?.anchor || newElementId;
      }
      drawTramlines();
      autoSave();
      showToast('Line extended');
      return;
    }
}

// ============================================================
// SLATES & CAMERAS
// ============================================================
function addSlate() {
  const name = prompt('Slate name (e.g. 1A, 2B):', `${state.slates.length + 1}A`);
  if (!name || !name.trim()) return;

  const slate = { id: 'slate-' + Date.now(), name: name.trim().toUpperCase(), cameras: [] };
  state.slates.push(slate);
  state.activeSlateId = slate.id;
  renderSidebar();
  autoSave();
  addCamera(slate.id);
}

function addCamera(slateId) {
  const slate = state.slates.find(s => s.id === slateId);
  if (!slate) return;

  if (slate.cameras.length >= 26) { showToast('Max 26 cameras per slate'); return; }

  let label;
  if (slate.cameras.length === 0) {
    // Derive letter from slate name — e.g. "2C" → C, "1A" → A
    const match = slate.name.match(/([A-Za-z])\s*$/);
    label = match ? match[1].toUpperCase() : 'A';
  } else {
    // Subsequent cameras increment from the previous one
    const prev = slate.cameras[slate.cameras.length - 1].label;
    label = String.fromCharCode(prev.charCodeAt(0) + 1);
    if (label > 'Z') label = 'A';
  }

  const cam = {
    id: 'cam-' + Date.now(),
    label,
    color: CAMERA_COLORS[colorIndex % CAMERA_COLORS.length],
    lines: [],
  };
  colorIndex++;

  slate.cameras.push(cam);
  state.activeCameraId = cam.id;
  renderSidebar();
  drawTramlines();
  autoSave();
}

function deleteCamera(camId) {
  if (!confirm('Delete this camera and all its lines?')) return;
  for (const slate of state.slates) {
    const idx = slate.cameras.findIndex(c => c.id === camId);
    if (idx !== -1) {
      slate.cameras.splice(idx, 1);
      if (state.activeCameraId === camId) state.activeCameraId = null;
      renderSidebar();
      drawTramlines();
      autoSave();
      return;
    }
  }
}

function deleteSlate(slateId) {
  if (!confirm('Delete this slate and all its cameras?')) return;
  const idx = state.slates.findIndex(s => s.id === slateId);
  if (idx !== -1) {
    if (state.activeSlateId === slateId) { state.activeSlateId = null; state.activeCameraId = null; }
    state.slates.splice(idx, 1);
    renderSidebar();
    drawTramlines();
    autoSave();
  }
}

function startEditSlateName(slateId, nameSpan) {
  const slate = state.slates.find(s => s.id === slateId);
  if (!slate) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = slate.name;
  input.className = 'slate-name-input';

  let saved = false;
  const save = () => {
    if (saved) return;
    saved = true;
    const newName = input.value.trim().toUpperCase();
    if (newName && newName !== slate.name) {
      renameSlateName(slateId, newName);
    } else {
      renderSidebar();
    }
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { saved = true; renderSidebar(); }
  });

  nameSpan.replaceWith(input);
  input.focus();
  input.select();
}

function renameSlateName(slateId, newName) {
  const slate = state.slates.find(s => s.id === slateId);
  if (!slate) return;
  slate.name = newName;

  // Re-derive camera labels from the new name
  const match = newName.match(/([A-Za-z])\s*$/);
  if (match && slate.cameras.length > 0) {
    const baseCode = match[1].toUpperCase().charCodeAt(0);
    slate.cameras.forEach((cam, i) => {
      cam.label = String.fromCharCode(baseCode + i);
    });
  }

  renderSidebar();
  drawTramlines();
  autoSave();
}

function setActiveCamera(camId) {
  state.activeCameraId = camId;
  for (const slate of state.slates)
    if (slate.cameras.find(c => c.id === camId)) { state.activeSlateId = slate.id; break; }

  if (state.addingLine) { setElemHighlight(state.lineStartId, false); state.addingLine = false; state.lineStartId = null; }
  state.selectedLineId = null;
  state.extendMode = null;
  renderSidebar();
  drawTramlines();
  updateLinePanel();
}

// ============================================================
// SIDEBAR
// ============================================================
function renderSidebar() {
  const list = document.getElementById('slates-list');
  list.innerHTML = '';

  if (state.slates.length === 0) {
    list.innerHTML = '<p class="empty-msg">No slates yet.<br>Import a script then tap<br><strong>+ Add Slate</strong></p>';
    return;
  }

  for (const slate of state.slates) {
    const div = document.createElement('div');
    div.className = 'slate-item';

    const header = document.createElement('div');
    header.className = 'slate-header';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'slate-name slate-name-editable';
    nameSpan.textContent = slate.name;
    nameSpan.title = 'Tap to rename';
    nameSpan.addEventListener('click', () => startEditSlateName(slate.id, nameSpan));

    const addCamBtn = document.createElement('button');
    addCamBtn.className = 'btn-xs btn-secondary';
    addCamBtn.textContent = '+ Cam';
    addCamBtn.addEventListener('click', () => addCamera(slate.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-xs btn-danger';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => deleteSlate(slate.id));

    header.appendChild(nameSpan);
    header.appendChild(addCamBtn);
    header.appendChild(delBtn);
    div.appendChild(header);

    if (slate.cameras.length > 0) {
      const cams = document.createElement('div');
      cams.className = 'cams-list';
      for (const cam of slate.cameras) {
        const camDiv = document.createElement('div');
        camDiv.className = 'cam-item' + (cam.id === state.activeCameraId ? ' cam-active' : '');
        camDiv.innerHTML = `
          <span class="cam-swatch" style="background:${cam.color}">${esc(slate.name)}</span>
          <span class="cam-label">Cam ${cam.label}</span>
          <span class="cam-count">${cam.lines.length}</span>
          <button class="btn-xs btn-ghost cam-del" onclick="event.stopPropagation();deleteCamera('${cam.id}')" title="Delete">✕</button>
        `;
        camDiv.addEventListener('click', () => setActiveCamera(cam.id));
        cams.appendChild(camDiv);
      }
      div.appendChild(cams);
    }

    list.appendChild(div);
  }
}

function updateLinePanel() {
  const panel = document.getElementById('line-panel');
  const noSel = document.getElementById('no-line-selected');
  const hasSel = document.getElementById('line-selected');

  if (!state.selectedLineId) {
    noSel.style.display = '';
    hasSel.style.display = 'none';
    return;
  }

  noSel.style.display = 'none';
  hasSel.style.display = '';

  // Show current type
  let lineType = '—';
  for (const slate of state.slates)
    for (const cam of slate.cameras) {
      const line = cam.lines.find(l => l.id === state.selectedLineId);
      if (line) { lineType = line.onCamera ? 'Straight (on camera)' : 'Squiggly (off camera)'; }
    }
  document.getElementById('sel-line-type').textContent = lineType;

  const extMode = state.extendMode;
  document.getElementById('btn-extend-start').classList.toggle('active', extMode === 'start');
  document.getElementById('btn-extend-end').classList.toggle('active', extMode === 'end');
}

// ============================================================
// STORAGE
// ============================================================
let db = null;

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('scriptliner', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('data', { keyPath: 'key' });
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

async function autoSave() {
  const data = { script: state.script, slates: state.slates, savedAt: new Date().toISOString() };
  // Native iCloud save (iOS/Mac WKWebView wrapper)
  if (window.webkit?.messageHandlers?.save) {
    window.webkit.messageHandlers.save.postMessage(JSON.stringify(data));
  }
  // IndexedDB fallback (plain browser)
  if (db) {
    const tx = db.transaction('data', 'readwrite');
    tx.objectStore('data').put({ key: 'session', ...data });
  }
  flashSave();
}

function flashSave() {
  const ind = document.getElementById('save-indicator');
  if (!ind) return;
  ind.textContent = '● Saved';
  ind.style.opacity = '1';
  clearTimeout(ind._t);
  ind._t = setTimeout(() => ind.style.opacity = '0', 1800);
}

async function loadSaved() {
  if (!db) return null;
  return new Promise(res => {
    const req = db.transaction('data', 'readonly').objectStore('data').get('session');
    req.onsuccess = e => res(e.target.result || null);
    req.onerror = () => res(null);
  });
}

// ============================================================
// IMPORT / EXPORT
// ============================================================
function exportAnnotations() {
  if (!state.slates.length) { showToast('Nothing to export yet'); return; }
  const data = {
    scriptTitle: state.script?.title || '',
    exportedAt: new Date().toISOString(),
    slates: state.slates,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(state.script?.title || 'script').replace(/[^a-z0-9]/gi, '_')}_lining.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Annotations exported — save to iCloud Drive');
}

function importAnnotations(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.slates)) throw new Error('Not a valid lining file');

      // Re-resolve anchors → current element IDs
      const anchorMap = state.script ? buildAnchorMap(state.script.elements) : {};
      let unresolved = 0;

      for (const slate of data.slates) {
        for (const cam of slate.cameras || []) {
          for (const line of cam.lines || []) {
            const s = resolveAnchor(line.startAnchor ?? line.startElementId, anchorMap);
            const e = resolveAnchor(line.endAnchor   ?? line.endElementId,   anchorMap);
            if (s == null || e == null) { unresolved++; continue; }
            line.startElementId = s;
            line.endElementId   = e;
          }
          // Remove any lines that couldn't be resolved
          cam.lines = (cam.lines || []).filter(l => l.startElementId != null && l.endElementId != null);
        }
      }

      state.slates = data.slates;
      colorIndex = state.slates.reduce((n, s) => n + s.cameras.length, 0);
      renderSidebar();
      drawTramlines();
      autoSave();
      const msg = unresolved ? `Loaded (${unresolved} line${unresolved > 1 ? 's' : ''} couldn't be matched to this script)` : 'Annotations loaded';
      showToast(msg);
    } catch (err) {
      showToast('Error: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ============================================================
// UTILS
// ============================================================
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2500);
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('sidebar-hidden');
}

// ============================================================
// INIT
// ============================================================
async function init() {
  db = await openDB();

  const saved = window.__nativeSession || await loadSaved();
  if (saved?.script) {
    state.script = saved.script;
    state.slates = saved.slates || [];
    colorIndex = state.slates.reduce((n, s) => n + s.cameras.length, 0);
    // Re-resolve anchors in case script was re-imported with edits
    const anchorMap = buildAnchorMap(state.script.elements);
    for (const slate of state.slates)
      for (const cam of slate.cameras || [])
        for (const line of cam.lines || []) {
          const s = resolveAnchor(line.startAnchor ?? line.startElementId, anchorMap);
          const e = resolveAnchor(line.endAnchor   ?? line.endElementId,   anchorMap);
          if (s != null) line.startElementId = s;
          if (e != null) line.endElementId   = e;
        }
    renderScript(state.script);
    renderSidebar();
    document.getElementById('script-title').textContent = state.script.title;
    requestAnimationFrame(() => { drawTramlines(); });
    showToast('Session restored');
  }

  // Import FDX — handles both toolbar input and empty-state input
  function handleFdxFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        state.script = parseFDX(ev.target.result);
        state.slates = []; state.activeCameraId = null; state.activeSlateId = null;
        state.selectedLineId = null; colorIndex = 0;
        renderScript(state.script);
        renderSidebar();
        document.getElementById('script-title').textContent = state.script.title;
        requestAnimationFrame(() => drawTramlines());
        autoSave();
        showToast(`Loaded: ${state.script.title}`);
      } catch (err) { showToast(err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }
  document.getElementById('fdx-input').addEventListener('change', handleFdxFile);
  const fdxEmpty = document.getElementById('fdx-input-empty');
  if (fdxEmpty) fdxEmpty.addEventListener('change', handleFdxFile);

  // Demo
  document.getElementById('btn-demo').addEventListener('click', () => {
    state.script = getDemoScript();
    state.slates = []; state.activeCameraId = null; state.activeSlateId = null;
    state.selectedLineId = null; colorIndex = 0;
    renderScript(state.script);
    renderSidebar();
    document.getElementById('script-title').textContent = state.script.title;
    requestAnimationFrame(() => drawTramlines());
    autoSave();
    showToast('Demo loaded — try adding a slate!');
  });

  // Add slate
  document.getElementById('btn-add-slate').addEventListener('click', () => {
    if (!state.script) { showToast('Import a script first'); return; }
    addSlate();
  });

  // Line type buttons
  document.querySelectorAll('.lt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.lineType = btn.dataset.type;
    });
  });

  // Sidebar selected line actions (keep for reference)
  document.getElementById('btn-delete-line').addEventListener('click', deleteSelectedLine);
  document.getElementById('btn-toggle-type').addEventListener('click', toggleSelectedLineType);
  document.getElementById('btn-extend-start').addEventListener('click', () => {
    state.extendMode = state.extendMode === 'start' ? null : 'start';
    updateLinePanel();
    if (state.extendMode) showToast('Tap element to move line start to');
  });
  document.getElementById('btn-extend-end').addEventListener('click', () => {
    state.extendMode = state.extendMode === 'end' ? null : 'end';
    updateLinePanel();
    if (state.extendMode) showToast('Tap element to move line end to');
  });

  // Popup buttons
  document.getElementById('popup-move-start').addEventListener('click', () => {
    hideLinePopup();
    state.extendMode = 'start';
    updateLinePanel();
    showToast('Tap element to move line start to');
  });
  document.getElementById('popup-move-end').addEventListener('click', () => {
    hideLinePopup();
    state.extendMode = 'end';
    updateLinePanel();
    showToast('Tap element to move line end to');
  });
  document.getElementById('popup-toggle-type').addEventListener('click', () => {
    toggleSelectedLineType();
    hideLinePopup();
  });
  document.getElementById('popup-delete').addEventListener('click', () => {
    deleteSelectedLine();
    hideLinePopup();
  });

  // Close popup on outside click
  document.addEventListener('click', (e) => {
    const popup = document.getElementById('line-popup');
    if (!popup.contains(e.target)) hideLinePopup();
  });

  // Export PDF
  document.getElementById('btn-export-pdf').addEventListener('click', () => {
    if (!state.script) { showToast('No script loaded'); return; }
    hideLinePopup();
    state.selectedLineId = null;
    drawTramlines();
    setTimeout(() => window.print(), 80);
  });

  // Export / Import annotations
  document.getElementById('btn-export').addEventListener('click', exportAnnotations);
  document.getElementById('ann-input').addEventListener('change', e => {
    const file = e.target.files[0]; if (file) importAnnotations(file); e.target.value = '';
  });

  // Sidebar toggle
  document.getElementById('btn-menu').addEventListener('click', toggleSidebar);

  // Cancel on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (state.addingLine) { setElemHighlight(state.lineStartId, false); state.addingLine = false; state.lineStartId = null; showToast('Cancelled'); }
      if (state.extendMode) { state.extendMode = null; updateLinePanel(); }
      if (state.selectedLineId) { state.selectedLineId = null; state.extendMode = null; drawTramlines(); updateLinePanel(); hideLinePopup(); }
    }
  });

  // Redraw on resize
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawTramlines, 100); });

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
