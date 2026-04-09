'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIODS = [];
for (let m = 1; m <= 12; m++) {
  for (const d of ['上旬', '中旬', '下旬']) PERIODS.push(`${m}月${d}`);
}

const WORK_TYPES = ['土づくり', '芽出し', '植付け', '芽かき', '土寄せ', '追肥', '水撒き', '収穫', 'その他'];
const CROP_STATUS = ['植えたい', '準備', '育成中', '完了'];
const CROP_EXPERIENCE = ['初めて', '2回目', '3回目', '4回目以上'];

const WORK_COLORS = {
  '土づくり': '#8D6E63', '芽出し': '#66BB6A', '植付け': '#42A5F5',
  '芽かき':   '#AB47BC', '土寄せ': '#795548', '追肥':   '#FFA726',
  '水撒き':   '#26C6DA', '収穫':   '#EF5350', 'その他': '#78909C',
};

const STATUS_COLORS = {
  '植えたい': '#90CAF9', '準備': '#FFF59D', '育成中': '#A5D6A7', '完了': '#BDBDBD',
};

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  page:           'home',
  cropFilter:     null,
  detailId:       null,
  pendingPhotos:  [],
  calendarCropId: null,
};

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  try {
    await DB.open();
  } catch (err) {
    alert('データベースの初期化に失敗しました: ' + err.message);
    return;
  }
  setupSidebar();
  await renderSidebar();
  await navigate('home');
}

// ── Navigation ────────────────────────────────────────────────────────────────

async function navigate(page, params = {}) {
  state.page = page;
  if ('cropFilter'     in params) state.cropFilter     = params.cropFilter;
  if ('detailId'       in params) state.detailId       = params.detailId;
  if ('calendarCropId' in params) state.calendarCropId = params.calendarCropId;
  state.pendingPhotos = [];

  await renderPage();
  closeSidebar();
  updateNavActive();
  await renderSidebar();
}

async function renderPage() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="page-loading">読み込み中…</div>';

  switch (state.page) {
    case 'home':         main.innerHTML = await buildHome();         break;
    case 'cropForm':     main.innerHTML = await buildCropForm();     break;
    case 'recordForm':   main.innerHTML = await buildRecordForm();   break;
    case 'plannedForm':  main.innerHTML = await buildPlannedForm();  break;
    case 'recordDetail': main.innerHTML = await buildRecordDetail(); break;
    case 'calendar':     main.innerHTML = await buildCalendar();     break;
    default:             main.innerHTML = await buildHome();
  }

  main.scrollTop = 0;
  initPageEvents();
}

function updateNavActive() {
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === state.page);
  });
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function setupSidebar() {
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
  document.getElementById('menu-btn').addEventListener('click', openSidebar);
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('show');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

async function renderSidebar() {
  const crops = await DB.crops.getAll();
  const growing = crops.filter(c => c.status === '育成中');

  const navItems = [
    { page: 'home',        icon: '🏡', label: 'ホーム' },
    { page: 'cropForm',    icon: '🌿', label: '作物登録' },
    { page: 'recordForm',  icon: '📝', label: '記録登録' },
    { page: 'plannedForm', icon: '📅', label: '予定作業登録' },
    { page: 'calendar',    icon: '🗓',  label: 'カレンダー' },
  ];

  document.getElementById('sidebar-nav').innerHTML = navItems.map(item => `
    <button class="nav-item${state.page === item.page && !state.cropFilter ? ' active' : ''}"
            data-page="${item.page}"
            onclick="navigate('${item.page}')">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
    </button>
    ${item.page === 'home' && growing.length > 0 ? `
      <div class="nav-subitems">
        ${growing.map(c => `
          <button class="nav-subitem${state.cropFilter === c.id ? ' active' : ''}"
                  onclick="navigate('home', {cropFilter: ${state.cropFilter === c.id ? 'null' : c.id}})">
            🌱 ${esc(c.name)}
          </button>
        `).join('')}
      </div>
    ` : ''}
  `).join('');
}

// ── Home Page ─────────────────────────────────────────────────────────────────

async function buildHome() {
  const [records, crops] = await Promise.all([DB.records.getAll(), DB.crops.getAll()]);
  const cropMap = Object.fromEntries(crops.map(c => [c.id, c]));

  let filtered = [...records].sort((a, b) => b.date.localeCompare(a.date));
  if (state.cropFilter) filtered = filtered.filter(r => r.cropId === state.cropFilter);

  const filterCrop = state.cropFilter ? cropMap[state.cropFilter] : null;
  const cropOpts  = crops.map(c => `<option value="${c.id}"${state.cropFilter === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
  const workOpts  = WORK_TYPES.map(w => `<option value="${esc(w)}">${esc(w)}</option>`).join('');

  return `
    <div class="page-header">
      <h1 class="page-title">
        ${filterCrop ? `🌱 ${esc(filterCrop.name)}` : '📋 記録一覧'}
      </h1>
      <button class="icon-btn" onclick="toggleFilter()" title="絞り込み">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
      </button>
    </div>

    <div id="filter-panel" class="filter-panel hidden">
      <div class="filter-grid">
        <div class="form-group-sm">
          <label>作物</label>
          <select id="f-crop">
            <option value="">すべて</option>
            ${cropOpts}
          </select>
        </div>
        <div class="form-group-sm">
          <label>作業種類</label>
          <select id="f-work">
            <option value="">すべて</option>
            ${workOpts}
          </select>
        </div>
        <div class="form-group-sm">
          <label>日付(開始)</label>
          <input type="date" id="f-from">
        </div>
        <div class="form-group-sm">
          <label>日付(終了)</label>
          <input type="date" id="f-to">
        </div>
      </div>
      <div class="filter-actions">
        <button class="btn-primary btn-sm" onclick="applyFilter()">絞り込む</button>
        <button class="btn-ghost btn-sm" onclick="clearFilter()">リセット</button>
      </div>
    </div>

    <div id="records-list">
      ${filtered.length === 0
        ? `<div class="empty-state">
             <div class="empty-icon">🌱</div>
             <p>記録がありません</p>
             <button class="btn-primary" onclick="navigate('recordForm')">最初の記録を追加する</button>
           </div>`
        : filtered.map(r => buildRecordCard(r, cropMap)).join('')
      }
    </div>
  `;
}

function buildRecordCard(r, cropMap) {
  const crop  = cropMap[r.cropId];
  const thumb = r.photos && r.photos.length > 0 ? r.photos[0].thumb : null;
  const workTags = (r.workTypes || []).map(w =>
    `<span class="work-tag" style="--tag-color:${WORK_COLORS[w] || '#78909C'}">${esc(w)}</span>`
  ).join('');

  return `
    <article class="card record-card" onclick="navigate('recordDetail', {detailId: ${r.id}})">
      ${thumb ? `<div class="card-thumb"><img src="${thumb}" alt="写真" loading="lazy"></div>` : ''}
      <div class="card-body">
        <div class="card-meta">
          <span class="card-date">${formatDate(r.date)}</span>
          ${crop ? `<span class="card-crop">${esc(crop.name)}</span>` : ''}
        </div>
        ${workTags ? `<div class="card-tags">${workTags}</div>` : ''}
        ${r.title ? `<div class="card-title">${esc(r.title)}</div>` : ''}
        ${r.body ? `<div class="card-body-preview">${esc(r.body.slice(0, 60))}${r.body.length > 60 ? '…' : ''}</div>` : ''}
      </div>
      <div class="card-arrow">›</div>
    </article>
  `;
}

function toggleFilter() {
  const panel = document.getElementById('filter-panel');
  panel.classList.toggle('hidden');
}

async function applyFilter() {
  const cropId   = parseInt(document.getElementById('f-crop').value) || null;
  const workType = document.getElementById('f-work').value;
  const from     = document.getElementById('f-from').value;
  const to       = document.getElementById('f-to').value;

  const [records, crops] = await Promise.all([DB.records.getAll(), DB.crops.getAll()]);
  const cropMap = Object.fromEntries(crops.map(c => [c.id, c]));

  let filtered = [...records].sort((a, b) => b.date.localeCompare(a.date));
  if (cropId)   filtered = filtered.filter(r => r.cropId === cropId);
  if (workType) filtered = filtered.filter(r => (r.workTypes || []).includes(workType));
  if (from)     filtered = filtered.filter(r => r.date >= from);
  if (to)       filtered = filtered.filter(r => r.date <= to);

  document.getElementById('records-list').innerHTML = filtered.length === 0
    ? `<div class="empty-state"><div class="empty-icon">🔍</div><p>該当する記録がありません</p></div>`
    : filtered.map(r => buildRecordCard(r, cropMap)).join('');
}

async function clearFilter() {
  state.cropFilter = null;
  await navigate('home');
}

// ── Crop Form ─────────────────────────────────────────────────────────────────

async function buildCropForm() {
  const periodOpts = `<option value="">未定</option>` + PERIODS.map(p => `<option>${p}</option>`).join('');

  return `
    <div class="page-header">
      <h1 class="page-title">🌿 作物登録</h1>
    </div>

    <form id="crop-form" class="form-card" onsubmit="saveCrop(event)">
      <div class="form-group">
        <label class="form-label">作物名 <span class="required">*</span></label>
        <input type="text" id="c-name" class="form-input" placeholder="例：トマト、ナス、キュウリ" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">植付け時期</label>
          <select id="c-plant" class="form-select">${periodOpts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">収穫時期</label>
          <select id="c-harvest" class="form-select">${periodOpts}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">状態</label>
          <select id="c-status" class="form-select">
            ${CROP_STATUS.map(s => `<option>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">育成経験</label>
          <select id="c-exp" class="form-select">
            ${CROP_EXPERIENCE.map(e => `<option>${e}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">備考</label>
        <textarea id="c-notes" class="form-textarea" rows="3" placeholder="メモ・特記事項など"></textarea>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary">登録する</button>
        <button type="button" class="btn-ghost" onclick="navigate('home')">キャンセル</button>
      </div>
    </form>

    <div class="section-title">登録済みの作物</div>
    <div id="crops-list" class="list-container"></div>
  `;
}

async function initCropForm() {
  const crops = await DB.crops.getAll();
  const list  = document.getElementById('crops-list');
  if (!list) return;

  if (crops.length === 0) {
    list.innerHTML = '<div class="empty-state-small">まだ作物が登録されていません</div>';
    return;
  }

  list.innerHTML = crops.map(c => `
    <div class="card crop-card">
      <div class="crop-header">
        <span class="crop-name">${esc(c.name)}</span>
        <span class="status-badge" style="background:${STATUS_COLORS[c.status] || '#eee'};color:#333">${esc(c.status)}</span>
      </div>
      <div class="crop-info">
        ${c.plantingPeriod ? `<span class="crop-info-item">🌱 植付け: ${esc(c.plantingPeriod)}</span>` : ''}
        ${c.harvestPeriod  ? `<span class="crop-info-item">🌾 収穫: ${esc(c.harvestPeriod)}</span>`   : ''}
        ${c.experience     ? `<span class="crop-info-item">📖 ${esc(c.experience)}</span>`            : ''}
      </div>
      ${c.notes ? `<div class="crop-notes">${esc(c.notes)}</div>` : ''}
      <div class="card-actions">
        <button class="btn-danger-sm" onclick="deleteCrop(${c.id}, event)">削除</button>
      </div>
    </div>
  `).join('');
}

async function saveCrop(e) {
  e.preventDefault();
  const name = document.getElementById('c-name').value.trim();
  if (!name) return;

  await DB.crops.add({
    name,
    plantingPeriod: document.getElementById('c-plant').value   || null,
    harvestPeriod:  document.getElementById('c-harvest').value || null,
    status:         document.getElementById('c-status').value,
    experience:     document.getElementById('c-exp').value,
    notes:          document.getElementById('c-notes').value.trim(),
  });

  showToast('作物を登録しました 🌱');
  document.getElementById('crop-form').reset();
  await initCropForm();
  await renderSidebar();
}

async function deleteCrop(id, e) {
  e.stopPropagation();
  if (!confirm('この作物を削除しますか？')) return;
  await DB.crops.delete(id);
  showToast('削除しました');
  await initCropForm();
  await renderSidebar();
}

// ── Record Form ───────────────────────────────────────────────────────────────

async function buildRecordForm() {
  const [records, crops] = await Promise.all([DB.records.getAll(), DB.crops.getAll()]);

  const lastUsed = {};
  records.forEach(r => {
    if (!lastUsed[r.cropId] || r.date > lastUsed[r.cropId]) lastUsed[r.cropId] = r.date;
  });
  const sorted = [...crops].sort((a, b) => (lastUsed[b.id] || '').localeCompare(lastUsed[a.id] || ''));

  const today = new Date().toISOString().slice(0, 10);

  return `
    <div class="page-header">
      <h1 class="page-title">📝 記録登録</h1>
    </div>

    <form id="record-form" class="form-card" onsubmit="saveRecord(event)">
      <div class="form-row">
        <div class="form-group flex1">
          <label class="form-label">日時 <span class="required">*</span></label>
          <input type="date" id="r-date" class="form-input" value="${today}" required>
        </div>
        <div class="form-group flex2">
          <label class="form-label">作物</label>
          <select id="r-crop" class="form-select">
            <option value="">未選択</option>
            ${sorted.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">作業種類</label>
        <div class="checkbox-group">
          ${WORK_TYPES.map(w => `
            <label class="checkbox-item">
              <input type="checkbox" name="work" value="${esc(w)}">
              <span class="checkbox-chip" style="--chip-color:${WORK_COLORS[w]}">${esc(w)}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">タイトル</label>
        <input type="text" id="r-title" class="form-input" placeholder="例：初めての追肥">
      </div>

      <div class="form-group">
        <label class="form-label">本文</label>
        <textarea id="r-body" class="form-textarea" rows="5"
          placeholder="作業の内容・気づいたことなど（500文字程度）" maxlength="1000"></textarea>
        <div class="char-count"><span id="body-count">0</span> / 1000</div>
      </div>

      <div class="form-group">
        <label class="form-label">写真（最大10枚）</label>
        <label class="photo-add-btn">
          <input type="file" id="photo-input" accept="image/*" multiple
                 onchange="addPhotos(this)" style="display:none">
          <span>📷 写真を追加・撮影</span>
        </label>
        <div id="photo-preview" class="photo-preview-grid"></div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-primary">記録する</button>
        <button type="button" class="btn-ghost" onclick="navigate('home')">キャンセル</button>
      </div>
    </form>
  `;
}

function initRecordForm() {
  const body = document.getElementById('r-body');
  const count = document.getElementById('body-count');
  if (body && count) {
    body.addEventListener('input', () => { count.textContent = body.value.length; });
  }
}

async function addPhotos(input) {
  const files = Array.from(input.files);
  const remaining = 10 - state.pendingPhotos.length;
  if (remaining <= 0) { showToast('写真は最大10枚です'); return; }

  const toProcess = files.slice(0, remaining);
  if (files.length > remaining) showToast(`${remaining}枚まで追加できます`);

  showToast('写真を処理中…');
  for (const file of toProcess) {
    const photo = await processPhoto(file);
    state.pendingPhotos.push(photo);
  }
  renderPhotoPreview();
  input.value = '';
}

function renderPhotoPreview() {
  const grid = document.getElementById('photo-preview');
  if (!grid) return;
  grid.innerHTML = state.pendingPhotos.map((p, i) => `
    <div class="photo-thumb-wrap">
      <img src="${p.thumb}" class="photo-thumb" alt="写真${i + 1}">
      <button type="button" class="photo-remove" onclick="removePhoto(${i})">✕</button>
    </div>
  `).join('');
}

function removePhoto(idx) {
  state.pendingPhotos.splice(idx, 1);
  renderPhotoPreview();
}

async function saveRecord(e) {
  e.preventDefault();
  const date = document.getElementById('r-date').value;
  if (!date) { showToast('日時を入力してください'); return; }

  const cropId   = parseInt(document.getElementById('r-crop').value) || null;
  const workTypes = Array.from(document.querySelectorAll('input[name="work"]:checked')).map(el => el.value);
  const crop     = cropId ? await DB.crops.get(cropId) : null;

  await DB.records.add({
    date,
    cropId,
    cropName: crop ? crop.name : '',
    workTypes,
    title:  document.getElementById('r-title').value.trim(),
    body:   document.getElementById('r-body').value.trim(),
    photos: state.pendingPhotos.map(p => ({ full: p.full, thumb: p.thumb })),
  });

  state.pendingPhotos = [];
  showToast('記録を保存しました 📝');
  await navigate('home');
}

// ── Planned Work Form ─────────────────────────────────────────────────────────

async function buildPlannedForm() {
  const crops = await DB.crops.getAll();
  const periodOpts = `<option value="">選択してください</option>` +
    PERIODS.map(p => `<option>${p}</option>`).join('');

  return `
    <div class="page-header">
      <h1 class="page-title">📅 予定作業登録</h1>
    </div>

    <form id="planned-form" class="form-card" onsubmit="savePlanned(event)">
      <div class="form-group">
        <label class="form-label">作物 <span class="required">*</span></label>
        <select id="p-crop" class="form-select" required>
          <option value="">選択してください</option>
          ${crops.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
        ${crops.length === 0 ? '<p class="form-hint">先に作物を登録してください</p>' : ''}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">時期 <span class="required">*</span></label>
          <select id="p-period" class="form-select" required>${periodOpts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">作業種類 <span class="required">*</span></label>
          <select id="p-work" class="form-select" required>
            <option value="">選択してください</option>
            ${WORK_TYPES.map(w => `<option>${esc(w)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">備考</label>
        <textarea id="p-notes" class="form-textarea" rows="3" placeholder="メモなど"></textarea>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary">登録する</button>
        <button type="button" class="btn-ghost" onclick="navigate('home')">キャンセル</button>
      </div>
    </form>

    <div class="section-title">登録済みの予定作業</div>
    <div id="planned-list" class="list-container"></div>
  `;
}

async function initPlannedForm() {
  const [planneds, crops] = await Promise.all([DB.planned.getAll(), DB.crops.getAll()]);
  const cropMap = Object.fromEntries(crops.map(c => [c.id, c]));
  const list = document.getElementById('planned-list');
  if (!list) return;

  if (planneds.length === 0) {
    list.innerHTML = '<div class="empty-state-small">予定作業が登録されていません</div>';
    return;
  }

  const sorted = [...planneds].sort((a, b) => PERIODS.indexOf(a.period) - PERIODS.indexOf(b.period));
  list.innerHTML = sorted.map(p => `
    <div class="card planned-card">
      <div class="planned-header">
        <span class="planned-period">${esc(p.period)}</span>
        <span class="work-tag" style="--tag-color:${WORK_COLORS[p.workType] || '#78909C'}">${esc(p.workType)}</span>
      </div>
      <div class="planned-crop-name">${esc(cropMap[p.cropId]?.name || '不明')}</div>
      ${p.notes ? `<div class="planned-notes">${esc(p.notes)}</div>` : ''}
      <div class="card-actions">
        <button class="btn-danger-sm" onclick="deletePlanned(${p.id}, event)">削除</button>
      </div>
    </div>
  `).join('');
}

async function savePlanned(e) {
  e.preventDefault();
  const cropId  = parseInt(document.getElementById('p-crop').value);
  const period  = document.getElementById('p-period').value;
  const workType = document.getElementById('p-work').value;
  if (!cropId || !period || !workType) return;

  const crop = await DB.crops.get(cropId);
  await DB.planned.add({
    cropId,
    cropName: crop ? crop.name : '',
    period,
    workType,
    notes: document.getElementById('p-notes').value.trim(),
  });

  showToast('予定作業を登録しました 📅');
  document.getElementById('planned-form').reset();
  await initPlannedForm();
}

async function deletePlanned(id, e) {
  e.stopPropagation();
  if (!confirm('この予定作業を削除しますか？')) return;
  await DB.planned.delete(id);
  showToast('削除しました');
  await initPlannedForm();
}

// ── Record Detail ─────────────────────────────────────────────────────────────

async function buildRecordDetail() {
  const r = await DB.records.get(state.detailId);
  if (!r) return `<div class="empty-state"><p>記録が見つかりません</p><button class="btn-primary" onclick="navigate('home')">ホームへ</button></div>`;

  const crop = r.cropId ? await DB.crops.get(r.cropId) : null;
  const photos = r.photos || [];

  const workTags = (r.workTypes || []).map(w =>
    `<span class="work-tag-lg" style="--tag-color:${WORK_COLORS[w] || '#78909C'}">${esc(w)}</span>`
  ).join('');

  return `
    <div class="page-header detail-header">
      <button class="back-btn" onclick="navigate('home')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        一覧へ
      </button>
      <button class="btn-danger-sm" onclick="deleteRecord(${r.id})">削除</button>
    </div>

    <div class="diary-card">
      <div class="diary-date-block">
        <div class="diary-date-day">${new Date(r.date + 'T00:00:00').getDate()}</div>
        <div class="diary-date-rest">
          <span class="diary-date-ym">${new Date(r.date + 'T00:00:00').getFullYear()}年${new Date(r.date + 'T00:00:00').getMonth() + 1}月</span>
          <span class="diary-date-dow">${['日','月','火','水','木','金','土'][new Date(r.date + 'T00:00:00').getDay()]}曜日</span>
        </div>
      </div>

      ${crop ? `<div class="diary-crop">${esc(crop.name)}</div>` : ''}
      ${workTags ? `<div class="diary-tags">${workTags}</div>` : ''}
      ${r.title ? `<h2 class="diary-title">${esc(r.title)}</h2>` : ''}

      ${photos.length > 0 ? `
        <div class="diary-photos${photos.length === 1 ? ' single' : ''}">
          ${photos.map((p, i) => `
            <div class="diary-photo" onclick="openPhotoViewer(${i})">
              <img src="${p.full}" alt="写真${i + 1}" loading="lazy">
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${r.body ? `<div class="diary-body">${escNl(r.body)}</div>` : ''}

      <div class="diary-footer">📅 ${formatDateTime(r.createdAt)}</div>
    </div>

    <div id="photo-viewer" class="photo-viewer hidden" onclick="closePhotoViewer()">
      <div class="photo-viewer-inner">
        <img id="photo-viewer-img" src="" alt="写真">
      </div>
    </div>
  `;
}

function openPhotoViewer(idx) {
  DB.records.get(state.detailId).then(r => {
    const photos = r.photos || [];
    if (!photos[idx]) return;
    document.getElementById('photo-viewer-img').src = photos[idx].full;
    document.getElementById('photo-viewer').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });
}

function closePhotoViewer() {
  document.getElementById('photo-viewer').classList.add('hidden');
  document.body.style.overflow = '';
}

async function deleteRecord(id) {
  if (!confirm('この記録を削除しますか？')) return;
  await DB.records.delete(id);
  showToast('削除しました');
  await navigate('home');
}

// ── Calendar Page ─────────────────────────────────────────────────────────────

async function buildCalendar() {
  const crops = await DB.crops.getAll();

  return `
    <div class="page-header">
      <h1 class="page-title">🗓 カレンダー</h1>
    </div>

    <div class="cal-controls">
      <label class="form-label">作物を選択</label>
      <select id="cal-crop" class="form-select" onchange="updateCalendar()">
        <option value="">作物を選んで表示</option>
        ${crops.map(c => `<option value="${c.id}"${state.calendarCropId === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>
    </div>

    <div class="cal-legend">
      <span class="cal-legend-item plant-legend">植付け時期</span>
      <span class="cal-legend-item harvest-legend">収穫時期</span>
      <span class="cal-legend-item planned-legend">● 予定作業</span>
      <span class="cal-legend-item record-legend">○ 記録</span>
    </div>

    <div id="cal-body" class="cal-body">
      <div class="cal-hint">作物を選ぶと予定・記録が表示されます</div>
    </div>
  `;
}

async function updateCalendar() {
  const sel    = document.getElementById('cal-crop');
  const cropId = sel ? (parseInt(sel.value) || null) : null;
  state.calendarCropId = cropId;

  const calBody = document.getElementById('cal-body');
  if (!calBody) return;

  if (!cropId) {
    calBody.innerHTML = '<div class="cal-hint">作物を選ぶと予定・記録が表示されます</div>';
    return;
  }

  const [crop, allPlanned, allRecords] = await Promise.all([
    DB.crops.get(cropId),
    DB.planned.getAll(),
    DB.records.getAll(),
  ]);

  const planned = allPlanned.filter(p => p.cropId === cropId);
  const records = allRecords.filter(r => r.cropId === cropId);
  const months  = getCalendarMonths();

  calBody.innerHTML = months.map(({ year, month }) =>
    buildCalendarMonth(year, month, crop, planned, records)
  ).join('');

  const current = calBody.querySelector('.cal-month.is-current');
  if (current) current.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getCalendarMonths() {
  const now = new Date();
  const result = [];
  for (let i = -6; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    result.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return result;
}

function buildCalendarMonth(year, month, crop, planned, records) {
  const now       = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
  const dekades   = ['上旬', '中旬', '下旬'];

  const rows = dekades.map(dk => {
    const periodStr  = `${month}月${dk}`;
    const isPlanting = crop && crop.plantingPeriod === periodStr;
    const isHarvest  = crop && crop.harvestPeriod  === periodStr;

    const plannedHere = planned.filter(p => p.period === periodStr);
    const recordsHere = records.filter(r => dateToPeriod(r.date) === periodStr);

    let bandClass = '';
    let bandLabel = '';
    if (isPlanting && isHarvest) { bandClass = 'band-both';    bandLabel = '植付け・収穫'; }
    else if (isPlanting)          { bandClass = 'band-plant';   bandLabel = '🌱 植付け時期'; }
    else if (isHarvest)           { bandClass = 'band-harvest'; bandLabel = '🌾 収穫時期'; }

    const dots = [
      ...plannedHere.map(p =>
        `<span class="cal-dot-wrap">
           <span class="cal-dot dot-planned" style="background:${WORK_COLORS[p.workType] || '#78909C'}"></span>
           <span class="cal-dot-label">${esc(p.workType)}</span>
         </span>`
      ),
      ...recordsHere.flatMap(r =>
        (r.workTypes || []).map(w =>
          `<span class="cal-dot-wrap">
             <span class="cal-dot dot-record" style="border-color:${WORK_COLORS[w] || '#78909C'}"></span>
             <span class="cal-dot-label">${esc(w)}</span>
           </span>`
        )
      ),
    ].join('');

    return `
      <div class="cal-row${bandClass ? ' ' + bandClass : ''}">
        <div class="cal-dekade">${dk}</div>
        <div class="cal-cell">
          ${bandLabel ? `<span class="cal-band-label">${bandLabel}</span>` : ''}
          ${dots ? `<div class="cal-dots">${dots}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="cal-month${isCurrent ? ' is-current' : ''}">
      <div class="cal-month-header">
        <span>${year}年${month}月</span>
        ${isCurrent ? '<span class="now-badge">今月</span>' : ''}
      </div>
      ${rows}
    </div>
  `;
}

// ── Page init dispatcher ──────────────────────────────────────────────────────

function initPageEvents() {
  switch (state.page) {
    case 'cropForm':    initCropForm();    break;
    case 'recordForm':  initRecordForm();  break;
    case 'plannedForm': initPlannedForm(); break;
    case 'calendar':    updateCalendar();  break;
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escNl(str) {
  return esc(str).replace(/\n/g, '<br>');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} `
       + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dateToPeriod(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const dk = d.getDate() <= 10 ? '上旬' : d.getDate() <= 20 ? '中旬' : '下旬';
  return `${d.getMonth() + 1}月${dk}`;
}

async function processPhoto(file) {
  const full  = await fileToDataURL(file);
  const thumb = await resizeImage(full, 400, 0.75);
  return { full, thumb };
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function resizeImage(dataURL, maxSize, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
      else        { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }
      const c = document.createElement('canvas');
      c.width = Math.round(w); c.height = Math.round(h);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.src = dataURL;
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
