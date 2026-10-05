/* JB Multiservices — administration (nécessite internet) */
'use strict';

const A = {
  refs: null,
  f: { preset: 'today', from: dayStr(), to: dayStr(), service_id: '', user_id: '', provider_id: '', product_id: '', category_id: '' }
};

const NAV = [
  { grp: 'Pilotage' },
  { to: 'dashboard', ic: 'chart', t: 'Tableau de bord', p: 'dashboard' },
  { to: 'sales', ic: 'receipt', t: 'Ventes', p: 'sales_all' },
  { to: 'reports', ic: 'report', t: 'Rapports', p: 'dashboard' },
  { grp: 'Catalogue et stock' },
  { to: 'products', ic: 'tag', t: 'Produits', p: 'products' },
  { to: 'stock', ic: 'box', t: 'Stock', p: 'stock' },
  { to: 'purchases', ic: 'truck', t: 'Achats', p: 'purchases' },
  { grp: 'Finances' },
  { to: 'credits', ic: 'credit', t: 'Ventes à crédit', p: 'credits' },
  { to: 'loans', ic: 'hand', t: 'Prêts', p: 'loans' },
  { to: 'expenses', ic: 'wallet', t: 'Dépenses', p: 'expenses' },
  { to: 'staff', ic: 'team', t: 'Employés et salaires', p: 'salaries' },
  { grp: 'Administration' },
  { to: 'users', ic: 'users', t: 'Utilisateurs', p: 'users' },
  { to: 'services', ic: 'grid', t: 'Services', p: 'services' },
  { to: 'audit', ic: 'eye', t: 'Journal d\'activité', p: 'audit' },
  { to: 'settings', ic: 'gear', t: 'Paramètres', p: 'settings' }
];

function firstAdminPage() { const n = NAV.find(x => x.to && can(x.p)); return n ? n.to : null; }

function adminShell(root, active, title, actions = '') {
  const items = [];
  let grp = null;
  NAV.forEach(n => {
    if (n.grp) { grp = n.grp; return; }
    if (!can(n.p)) return;
    if (grp) { items.push(`<div class="grp">${esc(grp)}</div>`); grp = null; }
    items.push(`<a href="#/admin/${n.to}" class="${n.to === active ? 'on' : ''}">${icon(n.ic)}${esc(n.t)}</a>`);
  });
  root.innerHTML = `<div class="admin">
    <nav class="side" id="side" aria-label="Administration"><a href="#/">${icon('home')}Espace vente</a>${items.join('')}</nav>
    <section><div class="page-h"><button class="iconbtn menu-btn" id="menu" aria-label="Menu">${icon('menu')}</button><h1>${esc(title)}</h1>${actions}</div>
      ${S.online ? '' : `<div class="banner" style="margin-bottom:14px">${icon('sync')}<span class="grow">Hors ligne : l'administration a besoin d'internet. Les ventes restent possibles depuis l'espace vente.</span><button class="btn sm" onclick="route()">Réessayer</button></div>`}
      <div id="pg"></div></section></div>`;
  const side = $('#side', root);
  $('#menu', root).onclick = () => {
    side.classList.add('open');
    const sc = document.createElement('div'); sc.className = 'scrim'; document.body.appendChild(sc);
    const close = () => { side.classList.remove('open'); sc.remove(); };
    sc.onclick = close; $$('a', side).forEach(a => a.addEventListener('click', close));
  };
  return $('#pg', root);
}

function loading(el) { el.innerHTML = '<div class="loading"><span class="spin"></span></div>'; }
function fail(el, e, retry) {
  el.innerHTML = `<div class="empty card"><h3>${e.network ? 'Connexion internet requise' : 'Impossible de charger'}</h3><p>${esc(e.message)}</p><button class="btn" data-retry>Réessayer</button></div>`;
  $('[data-retry]', el).onclick = retry;
}

async function refs(force) {
  if (A.refs && !force) return A.refs;
  const get = r => call('list', { resource: r, limit: 3000 }).then(x => x.rows).catch(() => []);
  const [users, services, categories, products, employees] = await Promise.all(['users', 'services', 'categories', 'products', 'employees'].map(get));
  A.refs = { users, services, categories, products, employees };
  return A.refs;
}
const refName = (list, id, key = 'name') => { const x = (list || []).find(r => r.id === id); return x ? x[key] : (id || ''); };

/* =================== Barre de filtres =================== */
function presetRange(p) {
  const t = dayStr(), d = new Date();
  const ym = (y, m) => `${y}-${pad2(m)}`;
  switch (p) {
    case 'today': return [t, t];
    case 'yesterday': { const y = addDays(t, -1); return [y, y]; }
    case 'week': return [addDays(t, -((d.getDay() + 6) % 7)), t];
    case 'month': return [t.slice(0, 8) + '01', t];
    case 'prev_month': { const pm = new Date(d.getFullYear(), d.getMonth() - 1, 1); const last = new Date(d.getFullYear(), d.getMonth(), 0); return [ym(pm.getFullYear(), pm.getMonth() + 1) + '-01', dayStr(last)]; }
    case 'year': return [d.getFullYear() + '-01-01', t];
    case 'prev_year': return [(d.getFullYear() - 1) + '-01-01', (d.getFullYear() - 1) + '-12-31'];
    default: return null;
  }
}
const PRESETS = [['today', 'Aujourd\'hui'], ['yesterday', 'Hier'], ['week', 'Cette semaine'], ['month', 'Ce mois'], ['prev_month', 'Mois précédent'], ['year', 'Cette année'], ['prev_year', 'Année précédente'], ['custom', 'Période personnalisée']];

function filterBar(el, opts, onChange) {
  const r = A.refs || {};
  const f = A.f;
  const svcOpts = (r.services || []).map(s => ({ value: s.id, label: s.name }));
  const prodList = (r.products || []).filter(p => !f.service_id || p.service_id === f.service_id);
  const catList = (r.categories || []).filter(c => !f.service_id || !c.service_id || c.service_id === f.service_id);
  const empList = (r.employees || []).filter(e => !f.service_id || !e.service_id || e.service_id === f.service_id);
  el.innerHTML = `<div class="filters no-print">
    ${opts.period !== false ? `<select class="input" data-f="preset" aria-label="Période">${opt(PRESETS.map(([v, l]) => ({ value: v, label: l })), f.preset)}</select>
      <input class="input" type="date" data-f="from" value="${f.from}" aria-label="Du">
      <input class="input" type="date" data-f="to" value="${f.to}" aria-label="Au">` : ''}
    ${opts.service ? `<select class="input" data-f="service_id" aria-label="Service">${opt(svcOpts, f.service_id, { blank: 'Tous les services' })}</select>` : ''}
    ${opts.user ? `<select class="input" data-f="user_id" aria-label="Utilisateur">${opt((r.users || []).map(u => ({ value: u.id, label: u.name })), f.user_id, { blank: 'Tous les utilisateurs' })}</select>` : ''}
    ${opts.provider ? `<select class="input" data-f="provider_id" aria-label="Prestataire">${opt(empList.map(e => ({ value: e.id, label: e.name })), f.provider_id, { blank: 'Tous les prestataires' })}</select>` : ''}
    ${opts.category ? `<select class="input" data-f="category_id" aria-label="Catégorie">${opt(catList.map(c => ({ value: c.id, label: c.name })), f.category_id, { blank: 'Toutes les catégories' })}</select>` : ''}
    ${opts.product ? `<select class="input" data-f="product_id" aria-label="Produit">${opt(prodList.map(p => ({ value: p.id, label: p.name })), f.product_id, { blank: 'Tous les produits' })}</select>` : ''}
    ${typeof opts.extra === 'function' ? opts.extra() : (opts.extra || '')}
  </div>`;
  $$('[data-f]', el).forEach(i => i.onchange = () => {
    const k = i.dataset.f;
    if (k === 'preset') { f.preset = i.value; const rg = presetRange(i.value); if (rg) { f.from = rg[0]; f.to = rg[1]; } }
    else if (k === 'from' || k === 'to') { f[k] = i.value; f.preset = 'custom'; }
    else {
      f[k] = i.value;
      if (k === 'service_id') { f.product_id = ''; f.category_id = ''; f.provider_id = ''; }
    }
    filterBar(el, opts, onChange);
    onChange();
  });
}
const fPick = keys => { const o = {}; keys.forEach(k => { if (A.f[k]) o[k] = A.f[k]; }); return o; };

function bars(list, { fmt = money, max } = {}) {
  if (!list.length) return '<p class="muted small">Aucune donnée.</p>';
  const m = max || Math.max(...list.map(x => x.value), 1);
  return `<div class="bars">${list.map(x => `<div><div class="row"><span class="grow">${esc(x.label)}</span><b>${fmt(x.value)}</b></div><div class="bar"><i style="width:${Math.max(2, x.value / m * 100)}%"></i></div></div>`).join('')}</div>`;
}

/* =================== Tableau de bord =================== */
let chartInst = null;
async function pageDashboard(pg) {
  loading(pg);
  await refs();
  pg.innerHTML = '<div id="fb"></div><div id="db"></div>';
  const fb = $('#fb', pg), db = $('#db', pg);
  const load = async () => {
    loading(db);
    let d;
    try { d = await call('dashboard', fPick(['from', 'to', 'service_id', 'user_id', 'provider_id', 'product_id', 'category_id'])); }
    catch (e) { return fail(db, e, load); }
    const k = d.kpi;
    const delta = (a, b) => b ? Math.round((a - b) / Math.abs(b) * 100) : null;
    const dv = delta(k.revenue, k.prev_revenue);
    const costs = k.net_profit !== undefined;
    const card = (l, v, extra = '', cls = '') => `<div class="kpi ${cls}"><div class="l">${esc(l)}</div><div class="v">${v}</div>${extra ? `<div class="d">${extra}</div>` : ''}</div>`;
    db.innerHTML = `
      <div class="kpis">
        ${card('Chiffre d\'affaires', money(k.revenue), dv === null ? '<span class="muted">Pas de données sur la période précédente</span>' : `<span class="${dv >= 0 ? 'ok' : 'bad'}">${dv >= 0 ? '+' : ''}${dv} %</span> <span class="muted">vs période précédente (${money(k.prev_revenue)})</span>`, 'lead')}
        ${costs ? card('Bénéfice net', `<span class="${k.net_profit < 0 ? 'bad' : ''}">${money(k.net_profit)}</span>`, `<span class="muted">Marge brute ${money(k.gross_margin)}</span>`) : ''}
        ${card('Transactions', fmtNum(k.tx), `<span class="muted">Panier moyen ${money(k.avg_ticket)}</span>`)}
        ${card('Dépenses', money(k.expenses), k.salaries ? `<span class="muted">+ salaires ${money(k.salaries)}</span>` : '')}
        ${card('Achats', money(k.purchases))}
        ${card('Commissions', money(k.commission))}
        ${card('Créances clients', money(k.receivables), `<span class="muted">${k.receivables_count} crédit(s) en cours</span>`)}
        ${card('Prêts en cours', money(k.loans), `<span class="muted">${k.loans_count} prêt(s)</span>`)}
        ${card('Stock', `${fmtNum(k.stock_out)} <span class="small muted">rupture(s)</span>`, `<span class="${k.stock_low ? 'warn' : 'muted'}">${k.stock_low} produit(s) faible(s)</span>${costs ? ` · <span class="muted">valeur ${money(k.stock_value)}</span>` : ''}`)}
      </div>
      ${d.product_scoped ? '<p class="faint small" style="margin:-6px 0 14px">Filtre produit / catégorie / prestataire actif : dépenses et salaires ne sont pas ventilés.</p>' : ''}
      <div class="charts">
        <div class="card wide"><div class="row" style="margin-bottom:10px"><h3 class="grow">Évolution ${d.granularity === 'month' ? 'mensuelle' : 'journalière'}</h3></div><div class="chart-box"><canvas id="ch"></canvas></div></div>
        <div class="card"><h3 style="margin-bottom:6px">Ventes par service</h3>${bars(d.by_service)}</div>
        <div class="card"><h3 style="margin-bottom:6px">Paiements</h3>${bars(d.by_payment)}</div>
        <div class="card"><h3 style="margin-bottom:6px">Performance des vendeurs</h3>${bars(d.by_user.map(x => Object.assign({}, x, { label: x.label + ' · ' + x.count + ' vente(s)' })))}</div>
        <div class="card"><h3 style="margin-bottom:6px">Prestataires</h3>${d.by_provider.length ? tableHtml([{ k: 'label', label: 'Prestataire' }, { k: 'count', label: 'Prest.', num: true }, { k: 'value', label: 'Montant', num: true, fmt: fmtNum }, { k: 'commission', label: 'Commission', num: true, fmt: fmtNum }], d.by_provider) : '<p class="muted small">Aucune prestation.</p>'}</div>
        <div class="card"><h3 style="margin-bottom:6px">Produits les plus vendus</h3>${tableHtml([{ k: 'label', label: 'Produit' }, { k: 'qty', label: 'Qté', num: true, fmt: fmtNum }, { k: 'value', label: 'Montant', num: true, fmt: fmtNum }], d.top_products)}</div>
        <div class="card"><h3 style="margin-bottom:6px">Dépenses par catégorie</h3>${bars(d.expenses_by_category)}</div>
      </div>`;
    drawChart(d);
  };
  filterBar(fb, { service: true, user: true, provider: true, category: true, product: true }, load);
  await load();
}

async function drawChart(d) {
  const cv = $('#ch');
  if (!cv) return;
  try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'); }
  catch (e) { cv.parentElement.innerHTML = bars(d.series.map(s => ({ label: s.key, value: s.revenue }))); return; }
  if (chartInst) chartInst.destroy();
  const labels = d.series.map(s => d.granularity === 'month' ? s.key : fmtDay(s.key).slice(0, 5));
  const ds = [{ label: 'Chiffre d\'affaires', data: d.series.map(s => s.revenue), backgroundColor: '#C9A227', borderRadius: 4, maxBarThickness: 48 }];
  if (d.series[0] && d.series[0].margin !== undefined) ds.push({ label: 'Marge', data: d.series.map(s => s.margin), type: 'line', borderColor: '#F3EBD8', backgroundColor: '#F3EBD8', tension: .3, pointRadius: 2 });
  ds.push({ label: 'Dépenses', data: d.series.map(s => s.expenses), type: 'line', borderColor: '#DD6452', backgroundColor: '#DD6452', tension: .3, pointRadius: 2, borderDash: [4, 4] });
  Chart.defaults.color = '#A3977C';
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  chartInst = new Chart(cv, {
    type: 'bar', data: { labels, datasets: ds },
    options: {
      maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => c.dataset.label + ' : ' + money(c.raw) } } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: '#241F16' }, ticks: { callback: v => fmtNum(v) } } }
    }
  });
}

/* =================== Ventes =================== */
async function pageSales(pg) {
  loading(pg);
  await refs();
  pg.innerHTML = `<div id="fb"></div><div class="row wrap no-print" style="margin-bottom:12px"><input class="input grow" id="q" placeholder="Référence, client, vendeur…" style="max-width:340px">
    <span class="grow"></span><button class="btn sm" id="csv">${icon('download')} CSV</button><button class="btn sm" id="gs">${icon('report')} Google Sheets</button></div><div id="sl"></div>`;
  let q = '', last = [];
  const filters = () => Object.assign(fPick(['from', 'to', 'service_id', 'user_id', 'product_id', 'category_id']), q ? { q } : {});
  const load = async () => {
    const sl = $('#sl', pg); loading(sl);
    let r;
    try { r = await call('sales_query', filters()); } catch (e) { return fail(sl, e, load); }
    last = r.sales;
    sl.innerHTML = `<div class="kpis"><div class="kpi lead"><div class="l">Total des ventes valides</div><div class="v">${money(r.totals.total)}</div><div class="d muted">${r.totals.count} vente(s) · commissions ${money(r.totals.commission)}</div></div></div>
      ${r.truncated ? `<p class="warn small">Affichage limité aux ${r.sales.length} plus récentes sur ${r.count}. Affinez les filtres ou exportez.</p>` : ''}
      ${tableHtml([
        { k: 'date', label: 'Date', fmt: fmtDate }, { k: 'ref', label: 'Réf.' }, { k: 'service_name', label: 'Service' },
        { k: 'user_name', label: 'Vendeur' }, { k: 'provider_name', label: 'Prestataire' }, { k: 'client_name', label: 'Client' },
        { k: 'payment_mode', label: 'Paiement' }, { k: 'total', label: 'Total', num: true, fmt: fmtNum },
        { k: 'status', label: 'Statut', html: s => s.status === 'ANNULEE' ? '<span class="tag bad">Annulée</span>' : (s.offline ? '<span class="tag gold">Hors ligne</span>' : '<span class="tag ok">Valide</span>') }
      ], r.sales, { click: true })}`;
    bindRows(sl, r.sales, s => saleDetailModal(s.id, load));
  };
  filterBar($('#fb', pg), { service: true, user: true, category: true, product: true }, load);
  $('#q', pg).oninput = debounce(e => { q = e.target.value.trim(); load(); }, 400);
  $('#csv', pg).onclick = () => downloadCsv('ventes-' + A.f.from + '-' + A.f.to, ['Date', 'Référence', 'Service', 'Vendeur', 'Prestataire', 'Client', 'Paiement', 'Total', 'Commission', 'Statut'],
    last.map(s => [s.date, s.ref, s.service_name, s.user_name, s.provider_name, s.client_name, s.payment_mode, s.total, s.commission_total, s.status]));
  $('#gs', pg).onclick = () => exportSheets({ kind: 'sales', filters: filters(), title: `Ventes ${A.f.from} au ${A.f.to}` });
  await load();
}

async function exportSheets(d) {
  toast('Création du Google Sheet…');
  try { const r = await call('export_sheet', d, { timeout: 60000 }); window.open(r.url, '_blank'); toast(`Export créé (${r.rows} lignes).`, 'ok'); }
  catch (e) { toast(e.message, 'bad'); }
}

async function saleDetailModal(id, onChange) {
  let r;
  try { r = await call('sale_detail', { id }); } catch (e) { return toast(e.message, 'bad'); }
  const s = r.sale;
  const extra = s.extra ? (() => { try { return Object.entries(JSON.parse(s.extra)).map(([k, v]) => `${esc(k)} : ${esc(v)}`).join(' · '); } catch (e) { return ''; } })() : '';
  const m = modal('Vente ' + s.ref, `
    <p class="muted" style="margin-top:0">${fmtDate(s.date)} · ${esc(s.service_name)} · ${esc(s.user_name)}${s.provider_name ? ' · prestataire ' + esc(s.provider_name) : ''}</p>
    ${tableHtml([{ k: 'product_name', label: 'Produit' }, { k: 'qty', label: 'Qté', num: true, fmt: fmtNum }, { k: 'unit_price', label: 'Prix', num: true, fmt: fmtNum },
      ...(s.cost_total !== undefined ? [{ k: 'cost', label: 'Coût', num: true, fmt: fmtNum }] : []), { k: 'commission', label: 'Commission', num: true, fmt: fmtNum }, { k: 'total', label: 'Total', num: true, fmt: fmtNum }], r.items)}
    <div class="total" style="margin-top:14px"><span class="muted">Total · ${esc(s.payment_mode)}</span><b>${money(s.total)}</b></div>
    ${s.client_name ? `<p class="small">Client : ${esc(s.client_name)} ${esc(s.client_phone || '')}</p>` : ''}
    ${s.note ? `<p class="small">Note : ${esc(s.note)}</p>` : ''}${extra ? `<p class="small">${extra}</p>` : ''}
    <p class="small faint">${s.offline ? 'Saisie hors ligne, ' : ''}synchronisée le ${fmtDate(s.synced_at)} · appareil ${esc(s.device_id || '—')}</p>
    ${s.status === 'ANNULEE' ? `<div class="banner bad">Annulée par ${esc(s.cancelled_by)} : ${esc(s.cancel_reason)}</div>` : ''}`,
    { wide: true, footer: `${s.status !== 'ANNULEE' && can('sales_cancel') ? '<button class="btn danger" data-cancel>Annuler la vente</button>' : ''}<button class="btn primary" data-close>Fermer</button>` });
  const c = m.el.querySelector('[data-cancel]');
  if (c) c.onclick = async () => {
    const reason = await promptDialog('Annuler la vente ' + s.ref, 'Motif de l\'annulation (obligatoire)', { okLabel: 'Annuler la vente' });
    if (!reason) return;
    try { await call('sale_cancel', { id: s.id, reason }); toast('Vente annulée, stock restauré.', 'ok'); m.close(); onChange && onChange(); }
    catch (e) { toast(e.message, 'bad'); }
  };
}

/* =================== Rapports =================== */
async function pageReports(pg) {
  loading(pg);
  await refs();
  let group = 'day', last = null;
  const groups = [['day', 'Par jour'], ['week', 'Par semaine'], ['month', 'Par mois'], ['year', 'Par année'], ['service', 'Par service'], ['user', 'Par utilisateur'], ['provider', 'Par prestataire'], ['product', 'Par produit'], ['category', 'Par catégorie'], ['payment', 'Par mode de paiement']];
  pg.innerHTML = `<div id="fb"></div><div class="row wrap no-print" style="margin-bottom:12px">
    <span class="grow"></span><button class="btn sm" id="csv">${icon('download')} CSV</button><button class="btn sm" id="gs">${icon('report')} Google Sheets</button><button class="btn sm" id="pdf">${icon('print')} PDF / Imprimer</button></div>
    <div id="rp"></div>`;
  const filters = () => Object.assign(fPick(['from', 'to', 'service_id', 'user_id', 'provider_id', 'product_id', 'category_id']), { group_by: group });
  const load = async () => {
    const rp = $('#rp', pg); loading(rp);
    let r;
    try { r = await call('report', filters()); } catch (e) { return fail(rp, e, load); }
    last = r;
    const cols = [{ k: 'label', label: groups.find(g => g[0] === group)[1].replace('Par ', '').replace(/^./, c => c.toUpperCase()) },
      { k: 'tx', label: 'Ventes', num: true, fmt: fmtNum }, { k: 'qty', label: 'Quantité', num: true, fmt: fmtNum },
      { k: 'revenue', label: 'Chiffre d\'affaires', num: true, fmt: fmtNum }, { k: 'commission', label: 'Commissions', num: true, fmt: fmtNum },
      { k: 'expenses', label: 'Dépenses', num: true, fmt: fmtNum }, { k: 'salaries', label: 'Salaires', num: true, fmt: fmtNum }];
    if (r.show_cost) cols.push({ k: 'cost', label: 'Coût des ventes', num: true, fmt: fmtNum }, { k: 'margin', label: 'Marge brute', num: true, fmt: fmtNum }, { k: 'net', label: 'Résultat net', num: true, fmt: fmtNum });
    const foot = { label: 'Total' };
    cols.slice(1).forEach(c => { foot[c.k] = fmtNum(r.totals[c.k] || 0); });
    rp.innerHTML = `<div class="print-area"><h2 style="margin-bottom:4px">${esc(S.boot.settings.company_name)} — rapport ${esc(groups.find(g => g[0] === group)[1].toLowerCase())}</h2>
      <p class="muted" style="margin:0 0 12px">Du ${fmtDay(r.from)} au ${fmtDay(r.to)}${A.f.service_id ? ' · ' + esc(refName(A.refs.services, A.f.service_id)) : ''}${A.f.user_id ? ' · ' + esc(refName(A.refs.users, A.f.user_id)) : ''}</p>
      ${tableHtml(cols, r.rows, { foot })}</div>`;
    last.cols = cols;
  };
  filterBar($('#fb', pg), { service: true, user: true, provider: true, category: true, product: true, extra: () => `<select class="input" id="grp" aria-label="Regroupement">${opt(groups.map(([v, l]) => ({ value: v, label: l })), group)}</select>` }, load);
  pg.addEventListener('change', e => { if (e.target.id === 'grp') { group = e.target.value; load(); } });
  $('#csv', pg).onclick = () => last && downloadCsv('rapport-' + group + '-' + A.f.from + '-' + A.f.to, last.cols.map(c => c.label), last.rows.map(x => last.cols.map(c => x[c.k])));
  $('#gs', pg).onclick = () => exportSheets({ kind: 'report', filters: filters(), title: `Rapport ${group} ${A.f.from} au ${A.f.to}` });
  $('#pdf', pg).onclick = () => window.print();
  await load();
}

/* =================== Produits =================== */
async function pageProducts(pg) {
  loading(pg);
  await refs(true);
  let showInactive = false, q = '';
  const costs = can('costs');
  pg.innerHTML = `<div id="fb"></div><div class="row wrap" style="margin-bottom:12px"><input class="input" id="q" placeholder="Rechercher…" style="max-width:300px">
    <label class="check"><input type="checkbox" id="ina"><span>Afficher les inactifs</span></label><span class="grow"></span>
    <button class="btn primary" id="add">${icon('plus')} Nouveau produit</button></div><div id="pl"></div>`;
  const draw = () => {
    const r = A.refs;
    const list = r.products.filter(p => (showInactive || p.active) && (!A.f.service_id || p.service_id === A.f.service_id) && (!q || (p.name + ' ' + p.code).toLowerCase().includes(q)));
    const cols = [{ k: 'name', label: 'Produit / prestation' }, { k: 'service_id', label: 'Service', fmt: v => refName(r.services, v) }, { k: 'category_id', label: 'Catégorie', fmt: v => refName(r.categories, v) },
      { k: 'price', label: 'Prix de vente', num: true, fmt: v => v > 0 ? fmtNum(v) : 'Libre' }];
    if (costs) cols.push({ k: 'cost', label: 'Prix d\'achat', num: true, fmt: fmtNum }, { k: 'm', label: 'Marge', num: true, fmt: (v, p) => p.price > 0 && p.cost > 0 ? Math.round((p.price - p.cost) / p.price * 100) + ' %' : '—' });
    cols.push({ k: 'stock', label: 'Stock', num: true, fmt: (v, p) => p.track_stock ? fmtNum(v) + ' ' + (p.unit || '') : '—' },
      { k: 'active', label: '', html: p => !p.active ? '<span class="tag">Inactif</span>' : (p.track_stock && p.stock <= 0 ? '<span class="tag bad">Rupture</span>' : (p.track_stock && p.stock <= p.min_stock ? '<span class="tag warn">Faible</span>' : '')) });
    $('#pl', pg).innerHTML = tableHtml(cols, list, { click: true, empty: 'Aucun produit. Ajoutez le premier.' });
    bindRows(pg, list, p => productForm(p));
  };
  const productForm = (p) => {
    const r = A.refs;
    const isNew = !p;
    const fields = [
      { k: 'name', label: 'Nom', req: true, full: true },
      { k: 'service_id', label: 'Service', type: 'select', options: r.services.map(s => ({ value: s.id, label: s.name })), req: true, def: A.f.service_id },
      { k: 'category_id', label: 'Catégorie', type: 'select', options: r.categories.filter(c => c.active).map(c => ({ value: c.id, label: c.name + (c.service_id ? ' (' + refName(r.services, c.service_id) + ')' : '') })), blank: 'Sans catégorie' },
      { k: 'price', label: 'Prix de vente (0 = prix libre)', type: 'number', req: true, min: 0 },
      ...(costs ? [{ k: 'cost', label: 'Prix d\'achat', type: 'number', min: 0 }] : []),
      { k: 'unit', label: 'Unité', placeholder: 'bouteille, gallon, prestation…' },
      { k: 'code', label: 'Code (facultatif)' },
      ...(isNew ? [{ k: 'stock', label: 'Stock initial', type: 'number', min: 0, def: 0 }] : []),
      { k: 'min_stock', label: 'Seuil d\'alerte stock', type: 'number', min: 0 },
      { k: 'track_stock', label: 'Suivre le stock', type: 'checkbox', def: true, help: 'Décochez pour les prestations et services sans stock.' },
      { k: 'active', label: 'Actif (visible à la vente)', type: 'checkbox', def: true }
    ];
    formModal(isNew ? 'Nouveau produit' : p.name, fields, p || {}, async v => {
      await call('save', { resource: 'products', record: Object.assign({}, p || {}, v) });
      await refs(true); draw(); toast('Produit enregistré.', 'ok');
    }, { extra: isNew ? '' : `<p class="faint small">Le stock se modifie depuis la page Stock (achat, perte, inventaire) pour garder l'historique.</p>` });
  };
  filterBar($('#fb', pg), { period: false, service: true }, draw);
  $('#q', pg).oninput = debounce(e => { q = e.target.value.trim().toLowerCase(); draw(); }, 150);
  $('#ina', pg).onchange = e => { showInactive = e.target.checked; draw(); };
  $('#add', pg).onclick = () => productForm(null);
  draw();
}

/* =================== Stock =================== */
async function pageStock(pg) {
  loading(pg);
  await refs();
  let tab = 'levels';
  pg.innerHTML = `<div class="tabs"><button data-tab="levels" class="on">Niveaux de stock</button><button data-tab="moves">Mouvements</button></div><div id="fb"></div><div id="sc"></div>`;
  const sc = $('#sc', pg), fb = $('#fb', pg);
  const levels = async () => {
    loading(sc);
    let r;
    try { r = await call('stock_overview', fPick(['service_id'])); } catch (e) { return fail(sc, e, levels); }
    const s = r.summary;
    sc.innerHTML = `<div class="kpis">
      <div class="kpi"><div class="l">Produits suivis</div><div class="v">${s.products}</div></div>
      <div class="kpi"><div class="l">En rupture</div><div class="v ${s.out ? 'bad' : ''}">${s.out}</div></div>
      <div class="kpi"><div class="l">Stock faible</div><div class="v ${s.low ? 'warn' : ''}">${s.low}</div></div>
      ${s.value !== undefined ? `<div class="kpi"><div class="l">Valeur du stock (prix d'achat)</div><div class="v">${money(s.value)}</div></div>` : ''}</div>
      ${tableHtml([{ k: 'name', label: 'Produit' }, { k: 'service_id', label: 'Service', fmt: v => refName(A.refs.services, v) },
        { k: 'stock', label: 'Disponible', num: true, fmt: (v, p) => fmtNum(v) + ' ' + (p.unit || '') }, { k: 'min_stock', label: 'Seuil', num: true, fmt: fmtNum },
        ...(s.value !== undefined ? [{ k: 'value', label: 'Valeur', num: true, fmt: fmtNum }] : []),
        { k: 'status', label: 'État', html: p => p.status === 'RUPTURE' ? '<span class="tag bad">Rupture</span>' : p.status === 'FAIBLE' ? '<span class="tag warn">Faible</span>' : '<span class="tag ok">OK</span>' }
      ], r.products, { click: true, empty: 'Aucun produit avec suivi de stock.' })}
      <p class="faint small">Touchez un produit pour enregistrer une entrée, une perte, une casse ou un inventaire.</p>`;
    bindRows(sc, r.products, p => {
      const f = [{ k: 'type', label: 'Type de mouvement', type: 'select', options: [{ value: 'ENTREE', label: 'Entrée (réception sans achat)' }, { value: 'PERTE', label: 'Perte' }, { value: 'CASSE', label: 'Casse' }, { value: 'INVENTAIRE', label: 'Inventaire (quantité comptée)' }, { value: 'AJUSTEMENT', label: 'Ajustement (+/−)' }], req: true },
        { k: 'qty', label: 'Quantité', type: 'number', req: true }, { k: 'note', label: 'Motif', full: true, help: 'Obligatoire sauf pour une entrée.' }];
      formModal(p.name, f, {}, async v => {
        const r2 = await call('stock_adjust', Object.assign({ product_id: p.id }, v));
        toast('Stock mis à jour : ' + fmtNum(r2.stock), 'ok'); levels();
      }, { extra: `<p class="muted small">Stock actuel : <b class="gold">${fmtNum(p.stock)} ${esc(p.unit || '')}</b></p>` });
    });
  };
  const moves = async () => {
    loading(sc);
    let r;
    try { r = await call('list', Object.assign({ resource: 'stock_movements' }, fPick(['from', 'to', 'service_id', 'product_id']))); } catch (e) { return fail(sc, e, moves); }
    sc.innerHTML = tableHtml([{ k: 'date', label: 'Date', fmt: fmtDate }, { k: 'product_name', label: 'Produit' }, { k: 'type', label: 'Type', html: m => `<span class="tag ${m.qty < 0 ? 'bad' : 'ok'}">${esc(m.type)}</span>` },
      { k: 'qty', label: 'Quantité', num: true, fmt: v => (v > 0 ? '+' : '') + fmtNum(v) }, { k: 'stock_after', label: 'Stock après', num: true, fmt: fmtNum },
      { k: 'ref', label: 'Réf.' }, { k: 'user_name', label: 'Par' }, { k: 'note', label: 'Motif' }], r.rows, { empty: 'Aucun mouvement sur la période.' });
  };
  const draw = () => {
    if (tab === 'levels') { filterBar(fb, { period: false, service: true }, levels); levels(); }
    else { filterBar(fb, { service: true, product: true }, moves); moves(); }
  };
  $('.tabs', pg).onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; $$('.tabs button', pg).forEach(x => x.classList.toggle('on', x === b)); draw(); };
  draw();
}

/* =================== Achats =================== */
async function pagePurchases(pg) {
  loading(pg);
  await refs(true);
  pg.innerHTML = `<div id="fb"></div><div class="row" style="margin-bottom:12px"><span class="grow"></span><button class="btn primary" id="add">${icon('plus')} Nouvel achat</button></div><div id="pl"></div>`;
  const load = async () => {
    const pl = $('#pl', pg); loading(pl);
    let r;
    try { r = await call('list', Object.assign({ resource: 'purchases' }, fPick(['from', 'to', 'service_id', 'product_id']))); } catch (e) { return fail(pl, e, load); }
    pl.innerHTML = `<div class="kpis"><div class="kpi lead"><div class="l">Total des achats</div><div class="v">${money(r.sums.total)}</div><div class="d muted">${r.total} achat(s)</div></div></div>` +
      tableHtml([{ k: 'date', label: 'Date', fmt: fmtDay }, { k: 'supplier', label: 'Fournisseur' }, { k: 'product_name', label: 'Produit' }, { k: 'qty', label: 'Qté', num: true, fmt: fmtNum },
        { k: 'unit_cost', label: 'Prix unitaire', num: true, fmt: fmtNum }, { k: 'total', label: 'Total', num: true, fmt: fmtNum }, { k: 'user_name', label: 'Par' }, { k: 'note', label: 'Observation' }], r.rows, { empty: 'Aucun achat sur la période.' });
  };
  $('#add', pg).onclick = () => {
    const prods = A.refs.products.filter(p => p.active);
    const f = [{ k: 'product_id', label: 'Produit', type: 'select', options: prods.map(p => ({ value: p.id, label: p.name + ' — ' + refName(A.refs.services, p.service_id) })), req: true, full: true },
      { k: 'qty', label: 'Quantité', type: 'number', req: true, min: 0 }, { k: 'unit_cost', label: 'Prix unitaire d\'achat', type: 'number', req: true, min: 0 },
      { k: 'supplier', label: 'Fournisseur' }, { k: 'date', label: 'Date', type: 'date', def: dayStr() },
      { k: 'note', label: 'Observation', full: true }, { k: 'update_cost', label: 'Mettre à jour le prix d\'achat du produit', type: 'checkbox', def: true }];
    formModal('Nouvel achat', f, {}, async v => {
      const r = await call('purchase_create', v);
      toast('Achat enregistré. Nouveau stock : ' + fmtNum(r.stock), 'ok'); load(); refs(true);
    }, { extra: '<p class="faint small">Pour la recharge : achetez le solde Digicel/Natcom (quantité = montant de crédit, prix unitaire = coût par gourde, ex. 0,95).</p>' });
  };
  filterBar($('#fb', pg), { service: true, product: true }, load);
  await load();
}

/* =================== Crédits =================== */
async function pageCredits(pg) {
  loading(pg);
  await refs();
  let open = true;
  pg.innerHTML = `<div class="tabs"><button data-t="1" class="on">En cours</button><button data-t="0">Tous</button></div><div id="fb"></div>
    <div class="row wrap" style="margin-bottom:12px"><input class="input" id="q" placeholder="Client, téléphone, référence…" style="max-width:320px"><span class="grow"></span><button class="btn primary" id="add">${icon('plus')} Nouveau crédit</button></div><div id="cl"></div>`;
  let q = '';
  const fb = $('#fb', pg);
  const load = async () => {
    const cl = $('#cl', pg); loading(cl);
    let r;
    const f = Object.assign({ resource: 'credits' }, open ? { open: true } : fPick(['from', 'to']), fPick(['service_id']), q ? { q } : {});
    try { r = await call('list', f); } catch (e) { return fail(cl, e, load); }
    cl.innerHTML = `<div class="kpis"><div class="kpi lead"><div class="l">Reste à encaisser</div><div class="v">${money(r.sums.balance)}</div><div class="d muted">${r.total} crédit(s) · montant initial ${money(r.sums.amount)} · déjà payé ${money(r.sums.paid)}</div></div></div>` +
      tableHtml([{ k: 'date', label: 'Date', fmt: fmtDay }, { k: 'client', label: 'Client' }, { k: 'phone', label: 'Téléphone' }, { k: 'ref', label: 'Vente' },
        { k: 'amount', label: 'Montant', num: true, fmt: fmtNum }, { k: 'paid', label: 'Payé', num: true, fmt: fmtNum }, { k: 'balance', label: 'Solde', num: true, html: c => `<b class="${c.balance > 0 ? 'gold' : ''}">${fmtNum(c.balance)}</b>` },
        { k: 'status', label: 'Statut', html: c => ({ OUVERT: '<span class="tag warn">Ouvert</span>', PARTIEL: '<span class="tag gold">Partiel</span>', SOLDE: '<span class="tag ok">Soldé</span>', ANNULE: '<span class="tag bad">Annulé</span>' }[c.status] || esc(c.status)) }
      ], r.rows, { click: true, empty: open ? 'Aucun crédit en cours.' : 'Aucun crédit sur la période.' });
    bindRows(cl, r.rows, c => creditModal(c.id, load));
  };
  const draw = () => { filterBar(fb, open ? { period: false, service: true } : { service: true }, load); load(); };
  $('.tabs', pg).onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; open = b.dataset.t === '1'; $$('.tabs button', pg).forEach(x => x.classList.toggle('on', x === b)); draw(); };
  $('#q', pg).oninput = debounce(e => { q = e.target.value.trim(); load(); }, 400);
  $('#add', pg).onclick = () => {
    const f = [{ k: 'client', label: 'Client', req: true }, { k: 'phone', label: 'Téléphone' }, { k: 'amount', label: 'Montant dû', type: 'number', req: true },
      { k: 'date', label: 'Date', type: 'date', def: dayStr() }, { k: 'service_id', label: 'Service', type: 'select', options: A.refs.services.map(s => ({ value: s.id, label: s.name })), blank: 'Aucun' }, { k: 'note', label: 'Note', full: true }];
    formModal('Nouveau crédit (dette existante)', f, {}, async v => { await call('credit_create', v); toast('Crédit créé.', 'ok'); load(); },
      { extra: '<p class="faint small">Les ventes à crédit faites à la caisse créent leur crédit automatiquement. Ce formulaire sert à reprendre des dettes existantes.</p>' });
  };
  draw();
}

async function creditModal(id, onChange) {
  let r;
  try { r = await call('credit_detail', { id }); } catch (e) { return toast(e.message, 'bad'); }
  const c = r.credit;
  const m = modal('Crédit — ' + c.client, `
    <div class="kpis"><div class="kpi"><div class="l">Montant</div><div class="v">${money(c.amount)}</div></div><div class="kpi"><div class="l">Payé</div><div class="v">${money(c.paid)}</div></div><div class="kpi"><div class="l">Solde</div><div class="v gold">${money(c.balance)}</div></div></div>
    <p class="muted small">${fmtDay(c.date)}${c.ref ? ' · vente ' + esc(c.ref) : ''}${c.phone ? ' · ' + esc(c.phone) : ''} · enregistré par ${esc(c.user_name)}${c.note ? '<br>' + esc(c.note) : ''}</p>
    ${r.items.length ? '<h3 style="margin:14px 0 8px">Articles</h3>' + tableHtml([{ k: 'product_name', label: 'Produit' }, { k: 'qty', label: 'Qté', num: true, fmt: fmtNum }, { k: 'total', label: 'Total', num: true, fmt: fmtNum }], r.items) : ''}
    <h3 style="margin:14px 0 8px">Historique des paiements</h3>
    ${tableHtml([{ k: 'date', label: 'Date', fmt: fmtDate }, { k: 'amount', label: 'Montant', num: true, fmt: fmtNum }, { k: 'payment_mode', label: 'Mode' }, { k: 'user_name', label: 'Reçu par' }, { k: 'note', label: 'Note' }], r.payments, { empty: 'Aucun paiement.' })}`,
    { wide: true, footer: `${c.balance > 0 && c.status !== 'ANNULE' ? '<button class="btn primary" data-pay>Enregistrer un paiement</button>' : ''}<button class="btn" data-close>Fermer</button>` });
  const b = m.el.querySelector('[data-pay]');
  if (b) b.onclick = () => {
    formModal('Paiement — ' + c.client, [{ k: 'amount', label: 'Montant reçu', type: 'number', req: true, def: c.balance }, { k: 'payment_mode', label: 'Mode', type: 'select', options: ['Cash', 'MonCash', 'NatCash'] }, { k: 'note', label: 'Note' }], {},
      async v => { await call('credit_payment', Object.assign({ credit_id: c.id }, v)); toast('Paiement enregistré.', 'ok'); m.close(); onChange && onChange(); creditModal(c.id, onChange); }, { okLabel: 'Encaisser' });
  };
}

/* =================== Prêts =================== */
async function pageLoans(pg) {
  pg.innerHTML = `<div class="row wrap" style="margin-bottom:12px"><label class="check"><input type="checkbox" id="all"><span>Inclure les prêts remboursés</span></label><span class="grow"></span><button class="btn primary" id="add">${icon('plus')} Nouveau prêt</button></div><div id="ll"></div>`;
  let all = false;
  const load = async () => {
    const ll = $('#ll', pg); loading(ll);
    let r;
    try { r = await call('list', Object.assign({ resource: 'loans' }, all ? {} : { status: 'EN_COURS' })); } catch (e) { return fail(ll, e, load); }
    ll.innerHTML = `<div class="kpis"><div class="kpi lead"><div class="l">Reste à rembourser</div><div class="v">${money(r.sums.balance)}</div><div class="d muted">${r.total} prêt(s) · prêté ${money(r.sums.amount)} · remboursé ${money(r.sums.repaid)}</div></div></div>` +
      tableHtml([{ k: 'date', label: 'Date', fmt: fmtDay }, { k: 'beneficiary', label: 'Bénéficiaire' }, { k: 'phone', label: 'Téléphone' }, { k: 'amount', label: 'Montant', num: true, fmt: fmtNum },
        { k: 'repaid', label: 'Remboursé', num: true, fmt: fmtNum }, { k: 'balance', label: 'Solde', num: true, html: l => `<b class="${l.balance > 0 ? 'gold' : ''}">${fmtNum(l.balance)}</b>` },
        { k: 'due_date', label: 'Échéance', html: l => l.due_date ? `<span class="${l.balance > 0 && l.due_date < dayStr() ? 'bad' : ''}">${fmtDay(l.due_date)}</span>` : '—' },
        { k: 'status', label: 'Statut', html: l => l.status === 'REMBOURSE' ? '<span class="tag ok">Remboursé</span>' : '<span class="tag warn">En cours</span>' }], r.rows, { click: true, empty: 'Aucun prêt.' });
    bindRows(ll, r.rows, l => loanModal(l.id, load));
  };
  $('#all', pg).onchange = e => { all = e.target.checked; load(); };
  $('#add', pg).onclick = () => formModal('Nouveau prêt', [{ k: 'beneficiary', label: 'Bénéficiaire', req: true }, { k: 'phone', label: 'Téléphone' }, { k: 'amount', label: 'Montant', type: 'number', req: true },
    { k: 'date', label: 'Date', type: 'date', def: dayStr() }, { k: 'due_date', label: 'Échéance', type: 'date' }, { k: 'note', label: 'Note', full: true }], {},
    async v => { await call('loan_create', v); toast('Prêt enregistré.', 'ok'); load(); });
  await load();
}

async function loanModal(id, onChange) {
  let r;
  try { r = await call('loan_detail', { id }); } catch (e) { return toast(e.message, 'bad'); }
  const l = r.loan;
  const m = modal('Prêt — ' + l.beneficiary, `
    <div class="kpis"><div class="kpi"><div class="l">Montant</div><div class="v">${money(l.amount)}</div></div><div class="kpi"><div class="l">Remboursé</div><div class="v">${money(l.repaid)}</div></div><div class="kpi"><div class="l">Solde</div><div class="v gold">${money(l.balance)}</div></div></div>
    <p class="muted small">Accordé le ${fmtDay(l.date)} par ${esc(l.user_name)}${l.due_date ? ' · échéance ' + fmtDay(l.due_date) : ''}${l.note ? '<br>' + esc(l.note) : ''}</p>
    <h3 style="margin:14px 0 8px">Remboursements</h3>
    ${tableHtml([{ k: 'date', label: 'Date', fmt: fmtDay }, { k: 'amount', label: 'Montant', num: true, fmt: fmtNum }, { k: 'payment_mode', label: 'Mode' }, { k: 'user_name', label: 'Reçu par' }, { k: 'note', label: 'Note' }], r.payments, { empty: 'Aucun remboursement.' })}`,
    { wide: true, footer: `${l.balance > 0 ? '<button class="btn primary" data-pay>Enregistrer un remboursement</button>' : ''}<button class="btn" data-close>Fermer</button>` });
  const b = m.el.querySelector('[data-pay]');
  if (b) b.onclick = () => formModal('Remboursement — ' + l.beneficiary, [{ k: 'amount', label: 'Montant', type: 'number', req: true, def: l.balance }, { k: 'payment_mode', label: 'Mode', type: 'select', options: ['Cash', 'MonCash', 'NatCash'] }, { k: 'date', label: 'Date', type: 'date', def: dayStr() }, { k: 'note', label: 'Note' }], {},
    async v => { await call('loan_payment', Object.assign({ loan_id: l.id }, v)); toast('Remboursement enregistré.', 'ok'); m.close(); onChange && onChange(); loanModal(l.id, onChange); });
}

/* =================== Dépenses =================== */
async function pageExpenses(pg) {
  loading(pg);
  await refs();
  const cats = (S.boot.settings.expense_categories || []);
  pg.innerHTML = `<div id="fb"></div><div class="row" style="margin-bottom:12px"><span class="grow"></span><button class="btn sm" id="csv">${icon('download')} CSV</button><button class="btn primary" id="add">${icon('plus')} Nouvelle dépense</button></div><div id="el"></div>`;
  let last = [];
  const fields = () => [{ k: 'amount', label: 'Montant', type: 'number', req: true }, { k: 'category', label: 'Catégorie', type: 'select', options: cats, req: true },
    { k: 'service_id', label: 'Service concerné', type: 'select', options: A.refs.services.map(s => ({ value: s.id, label: s.name })), blank: 'Général' },
    { k: 'payment_mode', label: 'Payé par', type: 'select', options: ['Cash', 'MonCash', 'NatCash'] }, { k: 'date', label: 'Date', type: 'date', def: dayStr() },
    { k: 'responsible', label: 'Responsable' }, { k: 'description', label: 'Description', type: 'textarea' }];
  const load = async () => {
    const el = $('#el', pg); loading(el);
    let r;
    try { r = await call('list', Object.assign({ resource: 'expenses' }, fPick(['from', 'to', 'service_id', 'user_id']))); } catch (e) { return fail(el, e, load); }
    last = r.rows;
    const byCat = {}; r.rows.forEach(x => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
    el.innerHTML = `<div class="charts" style="margin-bottom:14px"><div class="kpi lead" style="grid-column:auto"><div class="l">Total des dépenses</div><div class="v">${money(r.sums.amount)}</div><div class="d muted">${r.total} dépense(s)</div></div>
      <div class="card">${bars(Object.entries(byCat).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value))}</div></div>` +
      tableHtml([{ k: 'date', label: 'Date', fmt: fmtDay }, { k: 'category', label: 'Catégorie' }, { k: 'service_id', label: 'Service', fmt: v => v ? refName(A.refs.services, v) : 'Général' },
        { k: 'description', label: 'Description' }, { k: 'responsible', label: 'Responsable' }, { k: 'payment_mode', label: 'Mode' }, { k: 'amount', label: 'Montant', num: true, fmt: fmtNum }, { k: 'user_name', label: 'Saisie par' }], r.rows, { click: true, empty: 'Aucune dépense sur la période.' });
    bindRows(el, r.rows, x => {
      const m = formModal('Modifier la dépense', fields(), x, async v => { await call('save', { resource: 'expenses', record: Object.assign({ id: x.id }, v) }); toast('Dépense modifiée.', 'ok'); load(); });
      const del = document.createElement('button'); del.className = 'btn danger'; del.textContent = 'Supprimer';
      m.el.querySelector('.modal-f').prepend(del);
      del.onclick = async () => {
        const reason = await promptDialog('Supprimer la dépense', 'Motif (conservé dans le journal)', { okLabel: 'Supprimer' });
        if (!reason) return;
        try { await call('remove', { resource: 'expenses', id: x.id, reason }); m.close(); toast('Dépense supprimée.', 'ok'); load(); } catch (e) { toast(e.message, 'bad'); }
      };
    });
  };
  $('#add', pg).onclick = () => formModal('Nouvelle dépense', fields(), { responsible: S.acc.user.name }, async v => { await call('save', { resource: 'expenses', record: v }); toast('Dépense enregistrée.', 'ok'); load(); });
  $('#csv', pg).onclick = () => downloadCsv('depenses-' + A.f.from + '-' + A.f.to, ['Date', 'Catégorie', 'Service', 'Description', 'Responsable', 'Mode', 'Montant', 'Saisie par'],
    last.map(x => [x.date, x.category, x.service_id ? refName(A.refs.services, x.service_id) : 'Général', x.description, x.responsible, x.payment_mode, x.amount, x.user_name]));
  filterBar($('#fb', pg), { service: true, user: true }, load);
  await load();
}

/* =================== Employés et salaires =================== */
async function pageStaff(pg) {
  loading(pg);
  await refs(true);
  let tab = 'emp';
  pg.innerHTML = `<div class="tabs"><button data-t="emp" class="on">Employés et prestataires</button><button data-t="sal">Salaires</button></div><div id="sc"></div>`;
  const sc = $('#sc', pg);
  const empForm = (e) => {
    const f = [{ k: 'name', label: 'Nom complet', req: true }, { k: 'function', label: 'Fonction', placeholder: 'Barber, coiffeuse, serveur…' },
      { k: 'service_id', label: 'Service', type: 'select', options: A.refs.services.map(s => ({ value: s.id, label: s.name })), blank: 'Tous / aucun' },
      { k: 'phone', label: 'Téléphone' }, { k: 'base_salary', label: 'Salaire de base', type: 'number', min: 0 },
      { k: 'commission_pct', label: 'Commission personnelle (%)', type: 'number', min: 0, help: 'Laisser 0 pour utiliser le taux du service (ex. 40 % au Barbershop).' },
      { k: 'user_id', label: 'Compte utilisateur lié', type: 'select', options: A.refs.users.map(u => ({ value: u.id, label: u.name })), blank: 'Aucun' },
      { k: 'active', label: 'Actif', type: 'checkbox', def: true }];
    const rec = e ? Object.assign({}, e, { commission_pct: round2((e.commission_rate || 0) * 100) }) : {};
    formModal(e ? e.name : 'Nouvel employé', f, rec, async v => {
      v.commission_rate = round2(num(v.commission_pct) / 100); delete v.commission_pct;
      await call('save', { resource: 'employees', record: Object.assign({}, e || {}, v) }); await refs(true); toast('Employé enregistré.', 'ok'); draw();
    });
  };
  const emp = () => {
    sc.innerHTML = `<div class="row" style="margin-bottom:12px"><p class="muted small grow" style="margin:0">Les prestataires (barbers, coiffeuses) apparaissent à la caisse de leur service.</p><button class="btn primary" id="add">${icon('plus')} Nouvel employé</button></div>` +
      tableHtml([{ k: 'name', label: 'Nom' }, { k: 'function', label: 'Fonction' }, { k: 'service_id', label: 'Service', fmt: v => v ? refName(A.refs.services, v) : '—' }, { k: 'phone', label: 'Téléphone' },
        { k: 'base_salary', label: 'Salaire de base', num: true, fmt: fmtNum }, { k: 'commission_rate', label: 'Commission', num: true, fmt: v => v ? pct(v) : 'Taux du service' },
        { k: 'active', label: '', html: e => e.active ? '' : '<span class="tag">Inactif</span>' }], A.refs.employees, { click: true, empty: 'Aucun employé.' });
    $('#add', sc).onclick = () => empForm(null);
    bindRows(sc, A.refs.employees, empForm);
  };
  const sal = async () => {
    sc.innerHTML = '<div id="fb"></div><div class="row" style="margin-bottom:12px"><span class="grow"></span><button class="btn primary" id="add">' + icon('plus') + ' Enregistrer un salaire</button></div><div id="sl"></div>';
    const salFields = () => [{ k: 'employee_id', label: 'Employé', type: 'select', options: A.refs.employees.filter(e => e.active).map(e => ({ value: e.id, label: e.name })), req: true },
      { k: 'period', label: 'Période (mois)', type: 'month', req: true, def: dayStr().slice(0, 7) }, { k: 'amount', label: 'Montant', type: 'number', req: true },
      { k: 'status', label: 'Statut', type: 'select', options: [{ value: 'PAYE', label: 'Payé' }, { value: 'EN_ATTENTE', label: 'En attente' }] }, { k: 'pay_date', label: 'Date de paiement', type: 'date', def: dayStr() }, { k: 'note', label: 'Observation', full: true }];
    const load = async () => {
      const sl = $('#sl', sc); loading(sl);
      let r;
      try { r = await call('list', Object.assign({ resource: 'salaries' }, fPick(['from', 'to']))); } catch (e) { return fail(sl, e, load); }
      sl.innerHTML = `<div class="kpis"><div class="kpi lead"><div class="l">Total des salaires</div><div class="v">${money(r.sums.amount)}</div><div class="d muted">${r.total} paiement(s)</div></div></div>` +
        tableHtml([{ k: 'period', label: 'Période' }, { k: 'employee_name', label: 'Employé' }, { k: 'amount', label: 'Montant', num: true, fmt: fmtNum }, { k: 'pay_date', label: 'Payé le', fmt: fmtDay },
          { k: 'status', label: 'Statut', html: s => s.status === 'PAYE' ? '<span class="tag ok">Payé</span>' : '<span class="tag warn">En attente</span>' }, { k: 'note', label: 'Observation' }], r.rows, { click: true, empty: 'Aucun salaire sur la période.' });
      bindRows(sl, r.rows, s => {
        const m = formModal('Salaire — ' + s.employee_name, salFields(), s, async v => { await call('save', { resource: 'salaries', record: Object.assign({ id: s.id }, v) }); toast('Salaire modifié.', 'ok'); load(); });
        const del = document.createElement('button'); del.className = 'btn danger'; del.textContent = 'Supprimer';
        m.el.querySelector('.modal-f').prepend(del);
        del.onclick = async () => { const reason = await promptDialog('Supprimer', 'Motif', { okLabel: 'Supprimer' }); if (!reason) return; try { await call('remove', { resource: 'salaries', id: s.id, reason }); m.close(); load(); } catch (e) { toast(e.message, 'bad'); } };
      });
    };
    $('#add', sc).onclick = () => formModal('Enregistrer un salaire', salFields(), {}, async v => { await call('save', { resource: 'salaries', record: v }); toast('Salaire enregistré.', 'ok'); load(); });
    filterBar($('#fb', sc), {}, load);
    await load();
  };
  const draw = () => tab === 'emp' ? emp() : sal();
  $('.tabs', pg).onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; tab = b.dataset.t; $$('.tabs button', pg).forEach(x => x.classList.toggle('on', x === b)); draw(); };
  draw();
}

/* =================== Utilisateurs =================== */
async function pageUsers(pg) {
  loading(pg);
  await refs(true);
  const R = S.boot.roles || {}, P = S.boot.perms_catalog || {};
  const draw = () => {
    pg.innerHTML = `<div class="row" style="margin-bottom:12px"><span class="grow"></span><button class="btn primary" id="add">${icon('plus')} Nouvel utilisateur</button></div>` +
      tableHtml([{ k: 'name', label: 'Nom' }, { k: 'username', label: 'Identifiant' }, { k: 'title', label: 'Fonction' }, { k: 'role', label: 'Rôle', fmt: v => R[v] || v },
        { k: 'services', label: 'Espaces', fmt: (v, u) => u.role === 'SUPER_ADMIN' ? 'Tous' : String(v || '').split(',').filter(Boolean).map(id => refName(A.refs.services, id)).join(', ') },
        { k: 'last_login', label: 'Dernière connexion', fmt: fmtDate }, { k: 'active', label: '', html: u => u.active ? '<span class="tag ok">Actif</span>' : '<span class="tag">Inactif</span>' }], A.refs.users, { click: true });
    $('#add', pg).onclick = () => userForm(null);
    bindRows(pg, A.refs.users, userForm);
  };
  const userForm = (u) => {
    const isNew = !u;
    const f = [{ k: 'first_name', label: 'Prénom', req: true }, { k: 'last_name', label: 'Nom' }, { k: 'username', label: 'Identifiant de connexion', req: true, autocomplete: 'off' },
      { k: 'title', label: 'Titre / fonction' }, { k: 'role', label: 'Rôle', type: 'select', options: Object.keys(R).map(k => ({ value: k, label: R[k] })), req: true, def: 'VENDEUR' },
      { k: 'password', label: isNew ? 'Mot de passe (6 caractères min.)' : 'Nouveau mot de passe (laisser vide pour ne pas changer)', type: 'password', req: isNew, autocomplete: 'new-password' },
      { k: 'services', label: 'Espaces de vente autorisés', type: 'checks', options: A.refs.services.map(s => ({ value: s.id, label: s.name })) },
      { k: 'perms', label: 'Permissions supplémentaires (le Super Administrateur a tout)', type: 'checks', options: Object.keys(P).map(k => ({ value: k, label: P[k] })) },
      { k: 'active', label: 'Compte actif', type: 'checkbox', def: true }];
    const rec = u ? Object.assign({}, u, { password: '' }) : {};
    const m = formModal(isNew ? 'Nouvel utilisateur' : u.name, f, rec, async v => {
      if (!v.password) delete v.password;
      await call('save', { resource: 'users', record: Object.assign({}, u || {}, v) });
      await refs(true); draw(); toast('Utilisateur enregistré.', 'ok');
    }, { wide: true });
    if (!isNew) {
      const rv = document.createElement('button'); rv.className = 'btn'; rv.textContent = 'Déconnecter ses appareils';
      m.el.querySelector('.modal-f').prepend(rv);
      rv.onclick = async () => {
        if (!await confirmDialog('Déconnecter les appareils', 'Toutes les sessions de ' + u.name + ' seront fermées. Ses ventes hors ligne non envoyées devront être synchronisées après reconnexion.', 'Déconnecter', true)) return;
        try { await call('revoke_sessions', { user_id: u.id }); toast('Sessions fermées.', 'ok'); } catch (e) { toast(e.message, 'bad'); }
      };
    }
  };
  draw();
}

/* =================== Services et catégories =================== */
async function pageServices(pg) {
  loading(pg);
  await refs(true);
  let tab = 'srv';
  const T = S.boot.service_types || {};
  pg.innerHTML = `<div class="tabs"><button data-t="srv" class="on">Services</button><button data-t="cat">Catégories</button></div><div id="sc"></div>`;
  const sc = $('#sc', pg);
  const srvForm = (s) => {
    const f = [{ k: 'name', label: 'Nom', req: true }, { k: 'code', label: 'Code court (références)', req: true, placeholder: 'BAR' },
      { k: 'type', label: 'Type', type: 'select', options: Object.keys(T).map(k => ({ value: k, label: T[k] })), req: true },
      { k: 'commission_pct', label: 'Commission (%)', type: 'number', min: 0, help: 'Prestations : part du prestataire (40 % = 40/60). Produits : commission du vendeur.' },
      { k: 'logo', label: 'Logo (adresse de l\'image)', full: true }, { k: 'sort', label: 'Ordre d\'affichage', type: 'number' },
      { k: 'fields', label: 'Champs supplémentaires à la vente (JSON)', type: 'textarea', placeholder: '[{"key":"camion","label":"Camion"}]' },
      { k: 'track_stock', label: 'Suivre le stock', type: 'checkbox', def: true, help: 'Sans effet pour les prestations.' }, { k: 'active', label: 'Actif', type: 'checkbox', def: true }];
    const rec = s ? Object.assign({}, s, { commission_pct: round2((s.commission_rate || 0) * 100) }) : { type: 'PRODUIT' };
    formModal(s ? s.name : 'Nouveau service', f, rec, async v => {
      v.commission_rate = round2(num(v.commission_pct) / 100); delete v.commission_pct;
      await call('save', { resource: 'services', record: Object.assign({}, s || {}, v) });
      await refs(true); await refreshBoot({ silent: true }); draw(); toast('Service enregistré.', 'ok');
    }, { wide: true, extra: '<p class="faint small">Pour donner accès à un nouveau service, cochez-le dans la fiche des utilisateurs concernés.</p>' });
  };
  const catForm = (c) => formModal(c ? c.name : 'Nouvelle catégorie', [{ k: 'name', label: 'Nom', req: true }, { k: 'service_id', label: 'Service', type: 'select', options: A.refs.services.map(s => ({ value: s.id, label: s.name })), blank: 'Tous' }, { k: 'active', label: 'Active', type: 'checkbox', def: true }],
    c || {}, async v => { await call('save', { resource: 'categories', record: Object.assign({}, c || {}, v) }); await refs(true); draw(); toast('Catégorie enregistrée.', 'ok'); });
  const draw = () => {
    if (tab === 'srv') {
      sc.innerHTML = `<div class="row" style="margin-bottom:12px"><span class="grow"></span><button class="btn primary" id="add">${icon('plus')} Nouveau service</button></div>` +
        tableHtml([{ k: 'logo', label: '', html: s => s.logo ? `<img src="${esc(s.logo)}" alt="" style="width:36px;height:36px;object-fit:contain">` : '' }, { k: 'name', label: 'Service' }, { k: 'code', label: 'Code' }, { k: 'type', label: 'Type', fmt: v => T[v] || v },
          { k: 'commission_rate', label: 'Commission', num: true, fmt: (v, s) => v ? pct(v) + (s.commission_target === 'PRESTATAIRE' ? ' prestataire' : ' vendeur') : '—' },
          { k: 'active', label: '', html: s => s.active ? '<span class="tag ok">Actif</span>' : '<span class="tag">Inactif</span>' }], A.refs.services, { click: true });
      $('#add', sc).onclick = () => srvForm(null);
      bindRows(sc, A.refs.services, srvForm);
    } else {
      sc.innerHTML = `<div class="row" style="margin-bottom:12px"><span class="grow"></span><button class="btn primary" id="add">${icon('plus')} Nouvelle catégorie</button></div>` +
        tableHtml([{ k: 'name', label: 'Catégorie' }, { k: 'service_id', label: 'Service', fmt: v => v ? refName(A.refs.services, v) : 'Tous' }, { k: 'active', label: '', html: c => c.active ? '' : '<span class="tag">Inactive</span>' }], A.refs.categories, { click: true });
      $('#add', sc).onclick = () => catForm(null);
      bindRows(sc, A.refs.categories, catForm);
    }
  };
  $('.tabs', pg).onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; tab = b.dataset.t; $$('.tabs button', pg).forEach(x => x.classList.toggle('on', x === b)); draw(); };
  draw();
}

/* =================== Journal d'activité =================== */
async function pageAudit(pg) {
  loading(pg);
  await refs();
  let tab = 'act', q = '', module = '';
  pg.innerHTML = `<div class="tabs"><button data-t="act" class="on">Activité récente</button><button data-t="log">Journal complet</button></div><div id="sc"></div>`;
  const sc = $('#sc', pg);
  const logCols = [{ k: 'ts', label: 'Date', fmt: fmtDate }, { k: 'user_name', label: 'Utilisateur' }, { k: 'action', label: 'Action' }, { k: 'module', label: 'Module' },
    { k: 'details', label: 'Détails', fmt: v => { try { const o = JSON.parse(v); return typeof o === 'object' && o ? Object.entries(o).filter(([, x]) => x !== undefined && x !== '').map(([k, x]) => k + ' : ' + x).join(' · ') : String(o); } catch (e) { return v; } } },
    { k: 'old_value', label: 'Avant → après', html: l => l.old_value || l.new_value ? `<span class="faint small">${esc(l.old_value)}</span> → <span class="small">${esc(l.new_value)}</span>` : '' }];
  const act = async () => {
    loading(sc);
    let r;
    try { r = await call('activity'); } catch (e) { return fail(sc, e, act); }
    sc.innerHTML = `<div class="charts"><div class="card"><h3 style="margin-bottom:8px">Actifs ces 15 dernières minutes</h3>${r.online.length ? `<div class="list">${r.online.map(o => `<div><span class="dot"></span><span class="grow">${esc(o.name)}</span><span class="muted small">${fmtDate(o.last_seen)}</span></div>`).join('')}</div>` : '<p class="muted small">Personne pour le moment.</p>'}</div>
      <div class="card"><h3 style="margin-bottom:8px">Dernières connexions</h3><div class="list">${r.logins.slice(0, 10).map(o => `<div><span class="grow">${esc(o.name)}</span><span class="muted small">${fmtDate(o.last_login)}</span></div>`).join('')}</div></div>
      <div class="card wide"><h3 style="margin-bottom:8px">Dernières opérations</h3>${tableHtml(logCols, r.logs)}</div></div>`;
  };
  const log = async () => {
    sc.innerHTML = `<div id="fb"></div><div id="ll"></div>`;
    const load = async () => {
      const ll = $('#ll', sc); loading(ll);
      let r;
      try { r = await call('list', Object.assign({ resource: 'audit' }, fPick(['from', 'to', 'user_id']), q ? { q } : {}, module ? { module } : {})); } catch (e) { return fail(ll, e, load); }
      ll.innerHTML = `<p class="muted small">${r.total} entrée(s)${r.total > r.rows.length ? ', ' + r.rows.length + ' affichées' : ''}.</p>` + tableHtml(logCols, r.rows, { empty: 'Aucune entrée pour ces critères.' });
    };
    const bindQ = () => {
      $('#lq', sc).oninput = debounce(e => { q = e.target.value.trim(); load(); }, 400);
      $('#lm', sc).oninput = debounce(e => { module = e.target.value.trim(); load(); }, 400);
    };
    filterBar($('#fb', sc), { user: true, extra: () => `<input class="input" id="lq" placeholder="Rechercher (réf., produit…)" value="${esc(q)}"><input class="input" id="lm" placeholder="Module (Bar, Stock, Utilisateurs…)" value="${esc(module)}">` }, () => { bindQ(); load(); });
    bindQ();
    await load();
  };
  const draw = () => tab === 'act' ? act() : log();
  $('.tabs', pg).onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; tab = b.dataset.t; $$('.tabs button', pg).forEach(x => x.classList.toggle('on', x === b)); draw(); };
  draw();
}

/* =================== Paramètres =================== */
async function pageSettings(pg) {
  loading(pg);
  let r;
  try { r = await call('settings_get'); } catch (e) { return fail(pg, e, () => pageSettings(pg)); }
  const s = r.settings;
  const f = [{ k: 'company_name', label: 'Nom de l\'entreprise', req: true }, { k: 'currency', label: 'Devise affichée', req: true },
    { k: 'logo', label: 'Logo principal (adresse de l\'image)', full: true },
    { k: 'low_stock_default', label: 'Seuil d\'alerte stock par défaut', type: 'number' }, { k: 'vendor_history_days', label: 'Jours d\'historique visibles par un vendeur', type: 'number' },
    { k: 'session_days', label: 'Durée de session (jours)', type: 'number', help: 'Durée pendant laquelle un appareil reste connecté (et peut synchroniser) sans nouveau mot de passe.' },
    { k: 'block_oversell', label: 'Bloquer la vente au-delà du stock disponible', type: 'checkbox' },
    { k: 'expense_categories', label: 'Catégories de dépenses (séparées par des virgules)', type: 'textarea' },
    { k: 'receipt_footer', label: 'Message en bas du reçu', full: true }];
  const rec = Object.assign({}, s, { block_oversell: s.block_oversell === '1' });
  pg.innerHTML = `<div class="card" style="max-width:760px">${formHtml(f, rec)}<button class="btn primary" id="save" style="margin-top:16px">Enregistrer les paramètres</button></div>`;
  $('#save', pg).onclick = async () => {
    const err = $('.formerr', pg);
    try {
      const v = formRead(pg, f);
      v.block_oversell = v.block_oversell ? '1' : '0';
      await call('settings_save', { settings: v });
      await refreshBoot({ silent: true });
      toast('Paramètres enregistrés.', 'ok');
    } catch (e) { err.textContent = e.message; }
  };
}

const ADMIN_PAGES = {
  dashboard: ['Tableau de bord', pageDashboard], sales: ['Ventes', pageSales], reports: ['Rapports', pageReports],
  products: ['Produits et prestations', pageProducts], stock: ['Stock', pageStock], purchases: ['Achats', pagePurchases],
  credits: ['Ventes à crédit', pageCredits], loans: ['Prêts', pageLoans], expenses: ['Dépenses', pageExpenses], staff: ['Employés et salaires', pageStaff],
  users: ['Utilisateurs', pageUsers], services: ['Services et catégories', pageServices], audit: ['Journal d\'activité', pageAudit], settings: ['Paramètres', pageSettings]
};

async function viewAdmin(root, page) {
  page = page || firstAdminPage();
  const nav = NAV.find(n => n.to === page);
  if (!page || !nav || !can(nav.p)) { root.innerHTML = '<div class="empty card"><h3>Accès refusé</h3><p>Votre compte n\'a pas accès à cette page.</p></div>'; return; }
  const [title, fn] = ADMIN_PAGES[page];
  const pg = adminShell(root, page, title);
  if (!S.online) { try { await api('ping', {}, null, { timeout: 6000 }); } catch (e) { return; } }
  try { await fn(pg); } catch (e) { fail(pg, e, () => viewAdmin(root, page)); }
}
