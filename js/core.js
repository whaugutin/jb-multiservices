/* JB Multiservices — cœur de l'application (KonbitLab)
 * Utilitaires, stockage local (IndexedDB), API, synchronisation hors ligne, composants UI. */
'use strict';

const CFG = Object.assign({ API_URL: '', APP_VERSION: '1.0.0' }, window.JB_CONFIG || {});
const LOGO = 'https://i.postimg.cc/cCx0671R/JB-Multi-Services-Gold-Emblem.png';

/* =================== Utilitaires =================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
const dayStr = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const nowStr = (d = new Date()) => `${dayStr(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
const addDays = (day, k) => { const [y, m, d] = day.split('-').map(Number); return dayStr(new Date(y, m - 1, d + k)); };
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const num = v => { const n = Number(String(v).replace(',', '.').replace(/\s/g, '')); return isFinite(n) ? n : 0; };
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const fmtNum = n => nf.format(Number(n) || 0);
const money = n => fmtNum(n) + ' ' + (S.boot && S.boot.settings ? S.boot.settings.currency : 'HTG');
const fmtDate = s => { if (!s) return ''; const [d, t] = String(s).split(' '); const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}${t ? ' ' + t.slice(0, 5) : ''}`; };
const fmtDay = s => s ? fmtDate(String(s).slice(0, 10)) : '';
const pct = r => fmtNum(round2((Number(r) || 0) * 100)) + ' %';

function deviceId() {
  let id = localStorage.getItem('jb_device');
  if (!id) { id = 'DEV-' + uuid().slice(0, 8).toUpperCase(); localStorage.setItem('jb_device', id); }
  return id;
}

/* =================== Icônes =================== */
const ICONS = {
  back: '<path d="M15 18l-6-6 6-6"/>', home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.4a2 2 0 002 1.6h8.8a2 2 0 002-1.6L22 7H6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  sync: '<path d="M20 11a8 8 0 00-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0014.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>', logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h11"/>',
  history: '<path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 3"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M16 15h2"/>',
  receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  tag: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.3"/>', truck: '<path d="M1 5h14v11H1z"/><path d="M15 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  credit: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>', hand: '<path d="M7 11V6a2 2 0 014 0v5"/><path d="M11 10V4a2 2 0 014 0v6"/><path d="M15 10V6a2 2 0 014 0v8a8 8 0 01-8 8 7 7 0 01-6-3l-3-5a2 2 0 013-2.5L7 13"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>', team: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0114 0"/><path d="M16 4.5a3.5 3.5 0 010 7M22 20a7 7 0 00-4-6.3"/>',
  users: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/><path d="M19 3l2 2-2 2"/>', grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  report: '<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/><path d="M8 17v-3M12 17v-6M16 17v-2"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>', print: '<path d="M6 9V2h12v7"/><rect x="2" y="9" width="20" height="9" rx="2"/><path d="M6 14h12v8H6z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  water: '<path d="M12 3s7 7.5 7 12a7 7 0 01-14 0c0-4.5 7-12 7-12z"/>'
};
const icon = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* =================== Stockage local (IndexedDB) =================== */
const DB = (() => {
  let dbp;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('jb-multiservices', 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('accounts')) db.createObjectStore('accounts', { keyPath: 'username' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const st = t.objectStore(store);
      const out = fn(st);
      t.oncomplete = () => res(out && 'result' in out ? out.result : out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }
  return {
    get: (store, key) => tx(store, 'readonly', st => st.get(key)),
    put: (store, val, key) => tx(store, 'readwrite', st => key === undefined ? st.put(val) : st.put(val, key)),
    del: (store, key) => tx(store, 'readwrite', st => st.delete(key)),
    all: (store) => tx(store, 'readonly', st => st.getAll())
  };
})();

/* =================== API =================== */
class ApiError extends Error { constructor(msg, code) { super(msg); this.code = code; } }
class NetError extends Error { constructor(msg) { super(msg || 'Pas de connexion internet.'); this.network = true; } }

async function api(action, data = {}, token, { timeout = 25000 } = {}) {
  if (!CFG.API_URL) throw new ApiError('Adresse du serveur non configurée (config.js).', 'CONFIG');
  if (navigator.onLine === false) throw new NetError();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(CFG.API_URL, {
      method: 'POST', redirect: 'follow', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, data })
    });
  } catch (e) {
    throw new NetError(e.name === 'AbortError' ? 'Le serveur ne répond pas.' : undefined);
  } finally { clearTimeout(timer); }
  let json;
  try { json = await res.json(); } catch (e) { throw new NetError('Réponse du serveur illisible.'); }
  setOnline(true);
  if (!json.ok) throw new ApiError(json.error || 'Erreur serveur.', json.code);
  return json;
}

/** Appel API avec la session courante ; gère l'expiration de session. */
async function call(action, data, opts) {
  if (!S.acc) throw new ApiError('Non connecté.', 'AUTH');
  try {
    return await api(action, data, S.acc.token, opts);
  } catch (e) {
    if (e.network) setOnline(false);
    if (e.code === 'AUTH') await sessionExpired();
    throw e;
  }
}

/* =================== État global =================== */
const S = {
  acc: null,        // compte courant { username, token, user, verifier }
  boot: null,       // catalogue et paramètres (mis en cache)
  online: navigator.onLine !== false,
  syncing: false,
  pending: 0,
  errors: 0,
  lastSync: null
};

const can = p => !!(S.acc && S.acc.user && S.acc.user.perms && S.acc.user.perms.includes(p));
const isAdminUser = () => ['dashboard', 'sales_all', 'products', 'stock', 'purchases', 'credits', 'loans', 'expenses', 'salaries', 'users', 'services', 'audit', 'settings'].some(can);

function setOnline(v) {
  if (S.online === v) return;
  S.online = v;
  renderSyncPill();
  if (v) syncSoon(500);
}

/* =================== Vérificateur hors ligne (PBKDF2) =================== */
async function makeVerifier(password) {
  if (!(window.crypto && crypto.subtle)) return null;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt);
  return { salt: [...salt], hash };
}
async function checkVerifier(password, v) {
  if (!v || !(window.crypto && crypto.subtle)) return false;
  return (await pbkdf2(password, new Uint8Array(v.salt))) === v.hash;
}
async function pbkdf2(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* =================== Comptes et session =================== */
async function loginFlow(username, password) {
  username = String(username || '').trim().toLowerCase();
  try {
    const r = await api('login', { username, password, device: deviceId() }, null, { timeout: 15000 });
    const verifier = await makeVerifier(password).catch(() => null);
    const acc = { username, token: r.token, user: r.user, verifier, needsLogin: false, saved_at: Date.now() };
    await DB.put('accounts', acc);
    await setCurrent(acc);
    await refreshBoot({ silent: true });
    return { offline: false };
  } catch (e) {
    if (!e.network) throw e;
    const acc = await DB.get('accounts', username);
    if (acc && await checkVerifier(password, acc.verifier)) {
      await setCurrent(acc);
      S.boot = await DB.get('kv', 'boot:' + acc.user.id) || null;
      if (!S.boot) throw new Error('Aucune donnée enregistrée sur cet appareil pour ce compte. Connectez-vous une première fois avec internet.');
      return { offline: true };
    }
    throw new Error('Pas de connexion internet. La connexion hors ligne fonctionne uniquement pour un compte déjà utilisé sur cet appareil.');
  }
}

async function setCurrent(acc) {
  S.acc = acc;
  await DB.put('kv', acc ? acc.username : null, 'current');
}

/** Verrouille l'appareil (changement d'utilisateur) : la session reste valide pour la synchronisation. */
async function lockDevice() {
  await setCurrent(null);
  S.boot = null;
  go('/login');
}

/** Déconnexion complète : révoque la session côté serveur si rien n'est en attente. */
async function fullLogout() {
  const acc = S.acc;
  if (!acc) return go('/login');
  const mine = (await DB.all('outbox')).filter(o => o.username === acc.username);
  if (mine.length) {
    const okk = await confirmDialog('Opérations non envoyées',
      `${mine.length} opération(s) de ce compte ne sont pas encore synchronisées. L'appareil sera verrouillé mais la session restera active pour les envoyer dès le retour d'internet.`, 'Verrouiller');
    if (okk) await lockDevice();
    return;
  }
  try { await api('logout', {}, acc.token, { timeout: 8000 }); } catch (e) { /* hors ligne : la session expirera seule */ }
  await DB.del('accounts', acc.username);
  await DB.del('kv', 'boot:' + acc.user.id);
  await DB.del('kv', 'hist:' + acc.user.id);
  await setCurrent(null);
  S.boot = null;
  go('/login');
}

async function sessionExpired() {
  if (!S.acc) return;
  S.acc.needsLogin = true;
  await DB.put('accounts', S.acc);
  toast('Votre session a expiré. Reconnectez-vous pour continuer à synchroniser.', 'bad');
  const u = S.acc.username;
  await setCurrent(null);
  go('/login?u=' + encodeURIComponent(u));
}

/* =================== Catalogue (bootstrap) =================== */
async function refreshBoot({ silent } = {}) {
  if (!S.acc) return;
  try {
    const b = await call('bootstrap', {}, { timeout: 25000 });
    delete b.ok;
    S.acc.user = b.user;
    await DB.put('accounts', S.acc);
    await applyPendingToBoot(b);
    S.boot = b;
    b.fetched_at = Date.now();
    await DB.put('kv', b, 'boot:' + b.user.id);
    document.dispatchEvent(new CustomEvent('boot-updated'));
  } catch (e) {
    if (!S.boot) S.boot = await DB.get('kv', 'boot:' + S.acc.user.id) || null;
    if (!silent && !e.network) toast(e.message, 'bad');
  }
}

/** Le stock serveur ne connaît pas encore les ventes en attente : on les déduit localement. */
async function applyPendingToBoot(b) {
  const ops = (await DB.all('outbox')).filter(o => o.user_id === b.user.id);
  const prods = {}; (b.products || []).forEach(p => { prods[p.id] = p; });
  const credits = {}; (b.credits || []).forEach(c => { credits[c.id] = c; });
  ops.forEach(o => {
    if (o.type === 'sale') (o.payload.items || []).forEach(it => { if (prods[it.product_id]) prods[it.product_id].stock = round2(prods[it.product_id].stock - it.qty); });
    if (o.type === 'credit_payment' && credits[o.payload.credit_id]) credits[o.payload.credit_id].balance = round2(Math.max(0, credits[o.payload.credit_id].balance - o.payload.amount));
  });
}
async function saveBoot() { if (S.boot) await DB.put('kv', S.boot, 'boot:' + S.boot.user.id); }

/* =================== File d'attente et synchronisation =================== */
async function enqueue(type, payload) {
  const op = {
    id: payload.id || uuid(), type, payload, user_id: S.acc.user.id, username: S.acc.username,
    created_at: Date.now(), status: 'pending', attempts: 0, error: ''
  };
  payload.id = op.id;
  await DB.put('outbox', op);
  await countPending();
  return op;
}

async function countPending() {
  const all = await DB.all('outbox');
  S.pending = all.filter(o => o.status === 'pending').length;
  S.errors = all.filter(o => o.status === 'error').length;
  renderSyncPill();
  return all;
}

let syncTimer = null;
function syncSoon(ms = 300) { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow().catch(() => { }), ms); }

/** Envoie les opérations en attente, groupées par compte (chaque compte avec sa propre session). */
async function syncNow({ manual } = {}) {
  if (S.syncing) { S.syncAgain = true; return; }
  S.syncAgain = false;
  const all = await countPending();
  const pending = all.filter(o => o.status === 'pending').sort((a, b) => a.created_at - b.created_at);
  if (!pending.length) {
    if (manual) { try { await api('ping', {}, null, { timeout: 8000 }); toast('Connexion rétablie. Rien à synchroniser.', 'ok'); } catch (e) { toast('Toujours hors ligne.', 'bad'); } }
    return;
  }
  S.syncing = true; renderSyncPill();
  let synced = 0;
  const syncedSales = [];
  try {
    const byUser = {};
    pending.forEach(o => { (byUser[o.username] = byUser[o.username] || []).push(o); });
    outer:
    for (const username of Object.keys(byUser)) {
      const acc = await DB.get('accounts', username);
      if (!acc || !acc.token || acc.needsLogin) continue;
      const ops = byUser[username];
      for (let i = 0; i < ops.length; i += 20) {
        const chunk = ops.slice(i, i + 20);
        let res;
        try {
          res = await api('sync', { client_now: nowStr(), ops: chunk.map(o => ({ id: o.id, type: o.type, payload: o.payload })) }, acc.token, { timeout: 45000 });
        } catch (e) {
          if (e.network) { setOnline(false); break outer; }
          if (e.code === 'AUTH') { acc.needsLogin = true; await DB.put('accounts', acc); if (S.acc && S.acc.username === username) await sessionExpired(); continue outer; }
          break outer;
        }
        for (const r of res.results) {
          const op = chunk.find(o => o.id === r.id);
          if (!op) continue;
          if (r.ok) {
            await DB.del('outbox', op.id);
            synced++;
            if (op.type === 'sale') syncedSales.push({ op, ref: r.ref });
          } else if (r.permanent) {
            op.status = 'error'; op.error = r.error; op.attempts++;
            await DB.put('outbox', op);
          } else {
            op.attempts++; op.error = r.error;
            await DB.put('outbox', op);
          }
        }
      }
    }
  } finally {
    S.syncing = false;
    S.lastSync = Date.now();
    await countPending();
    if (S.syncAgain) syncSoon(200);
  }
  if (synced) {
    for (const s of syncedSales) await addToLocalHistory(s.op, true);
    if (S.acc) await refreshBoot({ silent: true });
    document.dispatchEvent(new CustomEvent('synced', { detail: { count: synced } }));
    if (manual || synced > 1) toast(`${synced} opération(s) synchronisée(s).`, 'ok');
  }
  if (S.errors && manual) toast(`${S.errors} opération(s) refusée(s) par le serveur : voir « Mon compte ».`, 'bad');
}

/** Historique local (affiché hors ligne). Les ventes synchronisées y restent marquées. */
async function addToLocalHistory(op, synced) {
  const key = 'hist:' + op.user_id;
  const h = (await DB.get('kv', key)) || [];
  const p = op.payload;
  const row = {
    id: op.id, ref: p.ref, date: p.date, service_id: p.service_id, service_name: p.service_name,
    payment_mode: p.payment_mode, total: p.total, status: 'VALIDE', client_name: p.client_name || '',
    provider_name: p.provider_name || '', items: (p.items || []).map(i => ({ product_name: i.product_name, qty: i.qty, unit_price: i.unit_price, total: round2(i.qty * i.unit_price) })),
    synced
  };
  const i = h.findIndex(x => x.id === row.id);
  if (i >= 0) h[i] = Object.assign(h[i], row); else h.unshift(row);
  const cutoff = addDays(dayStr(), -14);
  await DB.put('kv', h.filter(x => String(x.date).slice(0, 10) >= cutoff).slice(0, 800), key);
}

window.addEventListener('online', () => setOnline(true));
window.addEventListener('offline', () => setOnline(false));
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncSoon(800); });
setInterval(async () => {
  if (S.pending > 0) return syncNow().catch(() => { });
  if (!S.online) { try { await api('ping', {}, null, { timeout: 8000 }); } catch (e) { } }
}, 30000);

/* =================== Composants UI =================== */
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), kind === 'bad' ? 6000 : 3500);
}

function renderSyncPill() {
  const el = $('#syncpill');
  if (!el) return;
  let cls = '', txt;
  if (S.syncing) { cls = 'busy'; txt = 'Synchronisation…'; }
  else if (S.errors) { cls = 'err'; txt = `${S.errors} à vérifier`; }
  else if (!S.online) { cls = 'off'; txt = S.pending ? `Hors ligne · ${S.pending} en attente` : 'Hors ligne'; }
  else if (S.pending) { cls = 'off'; txt = `${S.pending} en attente`; }
  else txt = 'En ligne';
  el.className = 'pill ' + cls;
  el.innerHTML = `<span class="dot"></span><span>${txt}</span>`;
}

/** Fenêtre modale. Retourne { el, close }. */
function modal(title, body, { wide, footer = '', onClose } = {}) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-h"><h2>${esc(title)}</h2><button class="iconbtn" data-close aria-label="Fermer">${icon('x')}</button></div>
    <div class="modal-b">${body}</div>${footer ? `<div class="modal-f">${footer}</div>` : ''}</div>`;
  document.body.appendChild(bg);
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
  const first = bg.querySelector('input:not([type=hidden]),select,textarea');
  if (first && window.innerWidth > 640) setTimeout(() => first.focus(), 30);
  return { el: bg, close };
}

function confirmDialog(title, text, okLabel = 'Confirmer', danger = false) {
  return new Promise(res => {
    let done = false;
    const m = modal(title, `<p class="muted" style="margin:0">${esc(text)}</p>`, {
      footer: `<button class="btn ghost" data-close>Annuler</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(okLabel)}</button>`,
      onClose: () => { if (!done) res(false); }
    });
    m.el.querySelector('[data-ok]').onclick = () => { done = true; m.close(); res(true); };
  });
}

function promptDialog(title, label, { type = 'text', value = '', okLabel = 'Valider', required = true } = {}) {
  return new Promise(res => {
    let done = false;
    const m = modal(title, `<label class="f"><span>${esc(label)}</span><input class="input" name="v" type="${type}" value="${esc(value)}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''}></label><div class="formerr" style="margin-top:8px"></div>`, {
      footer: `<button class="btn ghost" data-close>Annuler</button><button class="btn primary" data-ok>${esc(okLabel)}</button>`,
      onClose: () => { if (!done) res(null); }
    });
    const inp = m.el.querySelector('input');
    setTimeout(() => inp.focus(), 30);
    const ok = () => {
      if (required && !inp.value.trim()) { m.el.querySelector('.formerr').textContent = 'Ce champ est obligatoire.'; return; }
      done = true; m.close(); res(inp.value);
    };
    m.el.querySelector('[data-ok]').onclick = ok;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  });
}

/* ---------- Formulaires générés ---------- */
function opt(list, sel, { blank } = {}) {
  return (blank !== undefined ? `<option value="">${esc(blank)}</option>` : '') +
    list.map(o => { const v = typeof o === 'object' ? o.value : o, l = typeof o === 'object' ? o.label : o; return `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(l)}</option>`; }).join('');
}

/** fields: [{k,label,type,options,req,placeholder,help,full,step,min}] */
function formHtml(fields, rec = {}) {
  return `<form class="stack" novalidate><div class="grid2">${fields.map(f => {
    const v = rec[f.k] === undefined || rec[f.k] === null ? (f.def !== undefined ? f.def : '') : rec[f.k];
    const span = f.full || f.type === 'textarea' || f.type === 'checks' ? 'style="grid-column:1/-1"' : '';
    const lbl = `<span>${esc(f.label)}${f.req ? ' *' : ''}</span>`;
    let inp;
    if (f.type === 'select') inp = `<select class="input" name="${f.k}">${opt(typeof f.options === 'function' ? f.options() : f.options, v, { blank: f.blank })}</select>`;
    else if (f.type === 'textarea') inp = `<textarea class="input" name="${f.k}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
    else if (f.type === 'checkbox') return `<label class="check" ${span}><input type="checkbox" name="${f.k}" ${v ? 'checked' : ''}><span>${esc(f.label)}${f.help ? `<br><small class="muted">${esc(f.help)}</small>` : ''}</span></label>`;
    else if (f.type === 'checks') {
      const sel = Array.isArray(v) ? v : String(v).split(',').filter(Boolean);
      const opts = typeof f.options === 'function' ? f.options() : f.options;
      inp = `<div class="grid2" data-checks="${f.k}">${opts.map(o => `<label class="check"><input type="checkbox" value="${esc(o.value)}" ${sel.includes(o.value) ? 'checked' : ''}><span>${esc(o.label)}</span></label>`).join('')}</div>`;
      return `<div ${span}><label class="f">${lbl}</label>${inp}</div>`;
    }
    else inp = `<input class="input" name="${f.k}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.type === 'number' ? `inputmode="decimal" step="${f.step || 'any'}" ${f.min !== undefined ? `min="${f.min}"` : ''}` : ''} ${f.autocomplete ? `autocomplete="${f.autocomplete}"` : ''}>`;
    return `<label class="f" ${span}>${lbl}${inp}${f.help ? `<small class="faint">${esc(f.help)}</small>` : ''}</label>`;
  }).join('')}</div><div class="formerr"></div></form>`;
}

function formRead(root, fields) {
  const out = {}, errs = [];
  fields.forEach(f => {
    if (f.type === 'checks') { out[f.k] = $$(`[data-checks="${f.k}"] input:checked`, root).map(i => i.value); return; }
    const el = root.querySelector(`[name="${f.k}"]`);
    if (!el) return;
    if (f.type === 'checkbox') { out[f.k] = el.checked; return; }
    let v = el.value.trim();
    if (f.req && v === '') errs.push(f.label);
    if (f.type === 'number' && v !== '') v = num(v);
    out[f.k] = v;
  });
  if (errs.length) { const e = new Error('Champs obligatoires : ' + errs.join(', ') + '.'); e.form = true; throw e; }
  return out;
}

/** Ouvre un formulaire modal ; onSave(values) peut lever une erreur affichée dans le formulaire. */
function formModal(title, fields, rec, onSave, { okLabel = 'Enregistrer', wide, extra = '' } = {}) {
  const m = modal(title, formHtml(fields, rec) + extra, { wide, footer: `<button class="btn ghost" data-close>Annuler</button><button class="btn primary" data-save>${esc(okLabel)}</button>` });
  const btn = m.el.querySelector('[data-save]');
  const errEl = m.el.querySelector('.formerr');
  const submit = async () => {
    errEl.textContent = '';
    let vals;
    try { vals = formRead(m.el, fields); } catch (e) { errEl.textContent = e.message; return; }
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    try { await onSave(vals, m); m.close(); }
    catch (e) { errEl.textContent = e.network ? 'Connexion internet requise pour cette action.' : e.message; }
    finally { btn.disabled = false; btn.textContent = okLabel; }
  };
  btn.onclick = submit;
  m.el.querySelector('form').addEventListener('submit', e => { e.preventDefault(); submit(); });
  return m;
}

/* ---------- Tableaux ---------- */
function tableHtml(cols, rows, { empty = 'Aucune donnée pour ces critères.', click, foot } = {}) {
  if (!rows.length) return `<div class="empty card flat">${esc(empty)}</div>`;
  return `<div class="tbl-wrap"><table class="t"><thead><tr>${cols.map(c => `<th class="${c.num ? 'num' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r, i) => `<tr ${click ? `class="click" data-row="${i}"` : ''}>${cols.map(c => `<td class="${c.num ? 'num' : ''}">${c.html ? c.html(r) : esc(c.fmt ? c.fmt(r[c.k], r) : r[c.k])}</td>`).join('')}</tr>`).join('')}</tbody>
  ${foot ? `<tfoot><tr>${cols.map(c => `<td class="${c.num ? 'num' : ''}">${foot[c.k] !== undefined ? esc(foot[c.k]) : ''}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
}
function bindRows(root, rows, fn) {
  $$('tr[data-row]', root).forEach(tr => tr.addEventListener('click', () => fn(rows[+tr.dataset.row])));
}

/** Export CSV (séparateur « ; » et BOM pour Excel). */
function downloadCsv(name, headers, rows) {
  const q = v => { const s = String(v === undefined || v === null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = '\ufeff' + [headers.map(q).join(';')].concat(rows.map(r => r.map(q).join(';'))).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if ($(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Chargement impossible : ' + src));
    document.head.appendChild(s);
  });
}

/* ---------- Libellés ---------- */
const svcById = id => (S.boot && S.boot.services || []).find(s => s.id === id) || null;
const prodById = id => (S.boot && S.boot.products || []).find(p => p.id === id) || null;
