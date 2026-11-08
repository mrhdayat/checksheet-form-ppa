'use strict';
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ver = t => `?v=${t.updated}-${t.size}`;
const fileUrl = (t, f) => `t/${t.id}/${f}${ver(t)}`;
const mb = n => (n / 1e6).toFixed(1).replace('.', ',') + ' MB';
const tgl = d => (d ? new Date(d + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const label = n => (/^\d+$/.test(n) ? `PM ${n}` : n);
const group = n => (/^\d+$/.test(n) ? 'PM' : n.replace(/\s*\d+$/, '').trim().toUpperCase());
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const LENS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M10.5 8v5M8 10.5h5"/></svg>';

let DATA = [];
let cat = 'Semua';
let query = '';

/* ---------- search: tahan salah ketik umum ---------- */
const ALIAS = { merci: 'mercy', mersi: 'mercy', mercedes: 'mercy', benz: 'mercy', pompa: 'dewatering', kompresor: 'compressor', lube: 'lt', water: 'wt', fuel: 'ft' };
const norm = s => s.toLowerCase().replace(/[^a-z0-9& ]+/g, ' ');
function matches(t, q) {
  const hay = norm(`${t.title} ${t.category} ${t.id} ${t.sheets.map(s => s.name).join(' ')}`);
  return norm(q).split(/\s+/).filter(Boolean).every(w => hay.includes(ALIAS[w] || w));
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, action) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button type="button">${esc(action.label)}</button>` : '');
  if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.fn(); };
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 6000 : 3500);
}

/* ---------- offline badge: file sudah ada di cache perangkat ---------- */
async function isOffline(t) {
  if (!('caches' in window)) return false;
  return !!(await caches.match(fileUrl(t, `${t.id}.pdf`)));
}

/* ---------- home ---------- */
function home() {
  document.title = 'Checksheet Plant · PPA Berau';
  const cats = ['Semua', ...new Set(DATA.map(t => t.category))];
  app.innerHTML = `
    <div class="search"><input type="search" id="q" placeholder="Cari unit: Hino, Mercy, pompa…" aria-label="Cari template"
      enterkeyhint="search" autocomplete="off" autocapitalize="none" value="${esc(query)}"></div>
    <div class="tabs" role="toolbar" aria-label="Kategori">${cats.map(c => {
      const n = c === 'Semua' ? DATA.length : DATA.filter(t => t.category === c).length;
      return `<button type="button" class="tab" data-cat="${esc(c)}" aria-pressed="${c === cat}">${esc(c)}<span>${n}</span></button>`;
    }).join('')}</div>
    <div id="list"></div>
    <p class="foot">${DATA.length} template · PDF A4, 1 sheet per halaman · update terakhir ${esc(tgl(DATA.map(t => t.updated).sort().pop()))}</p>`;
  $('#q').oninput = e => { query = e.target.value; list(); };
  app.querySelectorAll('.tab').forEach(b => b.onclick = () => {
    cat = b.dataset.cat;
    app.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-pressed', x === b));
    list();
  });
  list();
}

function rows(items) {
  return `<div class="register">
    <div class="register__head" aria-hidden="true"><span>No</span><span>Unit / Template</span><span>Sheet</span></div>
    <ul>${items.map((t, n) => `
    <li><a href="#/${t.id}">
      <span class="register__no">${n + 1}</span>
      <span class="register__main">
        <span class="register__cat">${esc(t.category)}</span>
        <span class="register__title">${esc(t.title)}</span>
        <span class="badge-off" data-off="${t.id}" hidden>✓ Tersedia offline</span>
      </span>
      <span class="register__n">${t.sheets.length}<small>${mb(t.size)}</small></span>
    </a></li>`).join('')}</ul></div>`;
}

function list() {
  const items = DATA.filter(t => (cat === 'Semua' || t.category === cat) && matches(t, query));
  const recent = store.get('recent', []).map(id => DATA.find(t => t.id === id)).filter(Boolean);
  let html = '';
  if (!query && cat === 'Semua' && recent.length) html += `<h2 class="section-h">Terakhir dibuka</h2>${rows(recent)}<h2 class="section-h">Semua template</h2>`;
  html += items.length ? rows(items)
    : `<p class="empty">Tidak ketemu “${esc(query)}”.<br>Coba: Hino, Mercy, pompa, compressor.</p>`;
  $('#list').innerHTML = html;
  DATA.forEach(async t => {
    if (await isOffline(t)) document.querySelectorAll(`[data-off="${t.id}"]`).forEach(b => b.hidden = false);
  });
}

/* ---------- template page ---------- */
function page(t) {
  document.title = `${t.title} · Checksheet PPA Berau`;
  store.set('recent', [t.id, ...store.get('recent', []).filter(x => x !== t.id)].slice(0, 5));
  let sel = store.get(`sel:${t.id}`, null);
  if (!Array.isArray(sel) || sel.length !== t.sheets.length) sel = t.sheets.map(() => true);

  const groups = {};
  t.sheets.forEach((s, i) => (groups[group(s.name)] ||= []).push(i));
  const multi = Object.entries(groups).filter(([, ix]) => ix.length > 1);

  app.innerHTML = `
    <a class="crumb" href="#/">‹ Semua template</a>
    <section class="tpl-head">
      <div class="tpl-head__title"><p>${esc(t.category)}</p><h1>${esc(t.title)}</h1></div>
      <dl>
        <div><dt>Sheet</dt><dd>${t.sheets.length}</dd></div>
        <div><dt>Ukuran</dt><dd>${mb(t.size)}</dd></div>
        <div><dt>Update</dt><dd>${esc(tgl(t.updated))}</dd></div>
      </dl>
    </section>
    <div class="quick" role="toolbar" aria-label="Pilih cepat">
      <button type="button" class="chip chip--plain" data-all="1">Pilih semua</button>
      <button type="button" class="chip chip--plain" data-all="0">Kosongkan</button>
      ${multi.map(([g, ix]) => `<button type="button" class="chip" data-group="${esc(g)}">${esc(g)} <span>×${ix.length}</span></button>`).join('')}
    </div>
    <div class="sheets">${t.sheets.map((s, i) => {
      const [w, h] = s.landscape ? [400, 283] : [283, 400];
      return `<label class="sheet">
        <input type="checkbox" data-i="${i}">
        <span class="sheet__paper">
          <img src="${fileUrl(t, `s${i}.jpg`)}" width="${w}" height="${h}" loading="lazy" decoding="async" alt="">
          <span class="sheet__box">${CHECK}</span>
          <button type="button" class="sheet__zoom" data-zoom="${i}" aria-label="Perbesar ${esc(label(s.name))}">${LENS}</button>
        </span>
        <span class="sheet__name">${esc(label(s.name))}<small>${s.landscape ? 'Landscape' : 'Portrait'}</small></span>
      </label>`;
    }).join('')}</div>
    <div class="bar"><div class="bar__in">
      <div class="bar__count" id="count"></div>
      <div class="bar__actions">
        <button type="button" class="btn" id="getXlsx">Excel</button>
        <button type="button" class="btn btn--primary" id="getPdf">Unduh PDF</button>
      </div>
      <div class="progress" id="prog" hidden><i></i></div>
    </div></div>`;

  const boxes = [...app.querySelectorAll('.sheet input')];
  const sync = () => {
    boxes.forEach((b, i) => { b.checked = sel[i]; });
    const n = sel.filter(Boolean).length;
    $('#count').innerHTML = n
      ? `<b>${n}</b> dari ${t.sheets.length} sheet · ${n} lembar A4`
      : 'Belum ada sheet dipilih. Centang minimal satu.';
    $('#getPdf').disabled = !n;
    app.querySelectorAll('[data-group]').forEach(c => c.setAttribute('aria-pressed', groups[c.dataset.group].every(i => sel[i])));
    store.set(`sel:${t.id}`, sel);
  };
  const setAll = v => { sel = sel.map(() => v); sync(); };
  boxes.forEach((b, i) => b.onchange = () => { sel[i] = b.checked; sync(); });
  app.querySelectorAll('[data-all]').forEach(c => c.onclick = () => {
    if (c.dataset.all === '1') return setAll(true);
    const before = sel.slice();
    setAll(false);
    toast('Semua centang dikosongkan.', { label: 'Batalkan', fn: () => { sel = before; sync(); } });
  });
  app.querySelectorAll('[data-group]').forEach(c => c.onclick = () => {
    const ix = groups[c.dataset.group];
    const on = !ix.every(i => sel[i]);
    ix.forEach(i => { sel[i] = on; });
    sync();
  });
  app.querySelectorAll('[data-zoom]').forEach(b => b.onclick = e => { e.preventDefault(); zoom(t, +b.dataset.zoom, () => sel, (i, v) => { sel[i] = v; sync(); }); });
  $('#getPdf').onclick = () => getFile(t, 'pdf', sel.flatMap((s, i) => (s ? [i] : [])));
  $('#getXlsx').onclick = () => getFile(t, 'xlsx');
  sync();
}

/* ---------- download ---------- */
function fileName(t, ext) {
  const today = new Date().toLocaleDateString('sv'); // YYYY-MM-DD, local time
  return `Checksheet-${t.category}-${t.title}`.replace(/&/g, 'dan').replace(/[^A-Za-z0-9-]+/g, '-') + `_${today}.${ext}`;
}

async function fetchBytes(u, onProgress) {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const total = +r.headers.get('content-length');
  if (!total || !r.body) return new Uint8Array(await r.arrayBuffer());
  const reader = r.body.getReader();
  const out = new Uint8Array(total);
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.set(value, got);
    got += value.length;
    onProgress(got / total);
  }
  return out;
}

function loadScript(src) {
  return new Promise((ok, fail) => {
    if (window.PDFLib) return ok();
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = fail;
    document.head.append(s);
  });
}

function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

let busy = false;
async function getFile(t, ext, idx) {
  if (busy) return;
  busy = true;
  const btn = ext === 'pdf' ? $('#getPdf') : $('#getXlsx');
  const prog = $('#prog');
  const setP = p => prog.firstElementChild.style.setProperty('--p', p);
  const text = btn.textContent;
  btn.setAttribute('aria-busy', 'true');
  btn.textContent = 'Mengunduh…';
  prog.hidden = false;
  setP(0);
  try {
    const bytes = await fetchBytes(fileUrl(t, `${t.id}.${ext}`), p => setP(p * (ext === 'pdf' ? 0.8 : 1)));
    let blob;
    if (ext === 'xlsx') {
      blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    } else if (idx.length === t.sheets.length) {
      blob = new Blob([bytes], { type: 'application/pdf' });
    } else {
      btn.textContent = `Menggabungkan ${idx.length} sheet…`;
      await loadScript('vendor/pdf-lib.min.js');
      const { PDFDocument } = window.PDFLib;
      const src = await PDFDocument.load(bytes);
      const out = await PDFDocument.create();
      (await out.copyPages(src, idx)).forEach(p => out.addPage(p));
      blob = new Blob([await out.save()], { type: 'application/pdf' });
    }
    setP(1);
    saveBlob(blob, fileName(t, ext));
    toast(ext === 'pdf' ? `PDF tersimpan · ${idx.length} lembar A4` : 'File Excel tersimpan');
  } catch (e) {
    console.error(e);
    toast(navigator.onLine
      ? 'Gagal mengunduh. Periksa sinyal lalu coba lagi.'
      : 'Kamu sedang offline dan file ini belum tersimpan di perangkat. Sambungkan internet sekali saja.',
    { label: 'Coba lagi', fn: () => getFile(t, ext, idx) });
  } finally {
    busy = false;
    btn.removeAttribute('aria-busy');
    btn.textContent = text;
    setTimeout(() => { prog.hidden = true; }, 400);
  }
}

/* ---------- zoom dialog ---------- */
function zoom(t, start, getSel, setSel) {
  const dlg = $('#zoom');
  let i = start;
  const show = () => {
    $('#zoomImg').src = fileUrl(t, `b${i}.jpg`);
    $('#zoomImg').alt = `Pratinjau ${label(t.sheets[i].name)}`;
    $('#zoomTitle').textContent = `${label(t.sheets[i].name)} · ${i + 1}/${t.sheets.length}`;
    $('#zoomCheck').checked = getSel()[i];
    $('#zoomPrev').disabled = i === 0;
    $('#zoomNext').disabled = i === t.sheets.length - 1;
  };
  const go = d => { i = Math.min(t.sheets.length - 1, Math.max(0, i + d)); show(); };
  $('#zoomPrev').onclick = () => go(-1);
  $('#zoomNext').onclick = () => go(1);
  $('#zoomClose').onclick = () => dlg.close();
  $('#zoomCheck').onchange = e => setSel(i, e.target.checked);
  dlg.onkeydown = e => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
  dlg.onclick = e => { if (e.target === dlg) dlg.close(); };
  let x0 = null;
  const body = dlg.querySelector('.zoom__body');
  body.ontouchstart = e => { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; };
  body.ontouchend = e => {
    if (x0 === null || window.visualViewport?.scale > 1) return; // pinch-zoomed: let the user pan
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  };
  show();
  dlg.showModal();
}

/* ---------- router ---------- */
function route() {
  if ($('#zoom').open) $('#zoom').close();
  const id = location.hash.replace(/^#\/?/, '');
  const t = DATA.find(x => x.id === id);
  if (id && !t) {
    app.innerHTML = `<p class="empty">Template “${esc(id)}” tidak ditemukan.<br><a href="#/">Kembali ke daftar</a></p>`;
  } else {
    t ? page(t) : home();
  }
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
}

/* ---------- network + service worker ---------- */
const net = () => { $('#net').hidden = navigator.onLine; };
addEventListener('online', net);
addEventListener('offline', net);
net();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
  navigator.serviceWorker.addEventListener('message', e => { if (e.data === 'update') $('#update').hidden = false; });
  $('#reload').onclick = () => location.reload();
}

// Hapus file versi lama dari cache perangkat (template yang sudah direvisi/dihapus).
function prune() {
  if (!('caches' in window)) return;
  caches.open('files').then(c => c.keys().then(keys => keys.forEach(r => {
    const u = new URL(r.url);
    const m = u.pathname.match(/\/t\/([^/]+)\//);
    const t = m && DATA.find(x => x.id === m[1]);
    if (m && (!t || u.search !== ver(t))) c.delete(r);
  })));
}

fetch('data.json')
  .then(r => r.json())
  .then(d => { DATA = d; route(); prune(); })
  .catch(() => { app.innerHTML = '<p class="empty">Daftar template belum bisa dimuat. Sambungkan internet lalu muat ulang.</p>'; });
addEventListener('hashchange', route);
