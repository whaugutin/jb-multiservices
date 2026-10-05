/* JB Multiservices — espace vendeur (fonctionne hors ligne) */
'use strict';

const CARTS = {}; // panier par service, conservé pendant la session

/* =================== Accueil : choix de l'espace =================== */
function svcLogo(s) {
  if (s.logo) return `<img src="${esc(s.logo)}" alt="" loading="lazy">`;
  return `<svg viewBox="0 0 24 24">${s.type === 'RECHARGE' ? ICONS.phone : ICONS.grid}</svg>`;
}

function viewHome(root) {
  const b = S.boot, u = S.acc.user;
  const first = (u.first_name || u.name || '').split(' ')[0];
  const h = new Date().getHours();
  const hello = h < 12 ? 'Bonjour' : (h < 18 ? 'Bon après-midi' : 'Bonsoir');
  const quick = [
    { to: '/history', ic: 'history', t: 'Mes ventes', d: 'Ventes du jour et historique' },
    can('credits') ? { to: '/collect', ic: 'hand', t: 'Encaisser un crédit', d: 'Paiement d\'un client' } : null,
    can('expenses') ? { to: '/expense', ic: 'wallet', t: 'Nouvelle dépense', d: 'Enregistrer une sortie d\'argent' } : null,
    isAdminUser() ? { to: '/admin', ic: 'chart', t: 'Administration', d: 'Tableau de bord, stock, rapports' } : null,
    { to: '/account', ic: 'user', t: 'Mon compte', d: 'Synchronisation, mot de passe' }
  ].filter(Boolean);

  root.innerHTML = `
    ${pendingBanner()}
    <div class="hello"><p class="muted" style="margin:0 0 2px">${esc(u.title || u.role_label || '')}</p><h1>${hello} ${esc(first)}</h1>
      <p class="muted" style="margin:6px 0 0">Choisissez l'espace où vous travaillez.</p></div>
    ${b.services.length ? `<div class="services">${b.services.map(s => `
      <button class="svc" data-svc="${esc(s.id)}"><span class="lg">${svcLogo(s)}</span><b>${esc(s.name)}</b></button>`).join('')}</div>`
      : `<div class="empty card"><h3>Aucun espace attribué</h3><p>Demandez à l'administrateur de vous donner accès à un service.</p></div>`}
    <div class="quick">${quick.map(q => `<button class="qa" data-go="${q.to}">${icon(q.ic)}<span><b>${esc(q.t)}</b><small>${esc(q.d)}</small></span></button>`).join('')}</div>`;
  $$('[data-svc]', root).forEach(el => el.onclick = () => go('/pos/' + el.dataset.svc));
  $$('[data-go]', root).forEach(el => el.onclick = () => go(el.dataset.go));
}

function pendingBanner() {
  if (S.errors) return `<div class="banner bad" style="margin-bottom:14px">${icon('x')}<span class="grow">${S.errors} opération(s) refusée(s) par le serveur.</span><button class="btn sm" onclick="go('/account')">Voir</button></div>`;
  if (!S.online) return `<div class="banner" style="margin-bottom:14px">${icon('sync')}<span class="grow">Mode hors ligne : les ventes sont enregistrées sur l'appareil et seront envoyées au retour d'internet.${S.pending ? ` (${S.pending} en attente)` : ''}</span></div>`;
  return '';
}

/* =================== Point de vente =================== */
function viewPos(root, serviceId) {
  const srv = svcById(serviceId);
  if (!srv) { root.innerHTML = `<div class="empty card"><h3>Espace introuvable</h3><p>Ce service n'est pas disponible pour votre compte.</p><button class="btn" onclick="go('/')">Retour aux services</button></div>`; return; }
  if (srv.type === 'RECHARGE') return viewRecharge(root, srv);

  const cart = CARTS[srv.id] = CARTS[srv.id] || [];
  const st = { cat: 'all', q: '' };
  const cats = S.boot.categories.filter(c => c.service_id === srv.id);
  const prods = () => S.boot.products.filter(p => p.service_id === srv.id && p.active)
    .filter(p => st.cat === 'all' || p.category_id === st.cat)
    .filter(p => !st.q || (p.name + ' ' + (p.code || '')).toLowerCase().includes(st.q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const tracks = p => srv.track_stock && p.track_stock;
  const inCart = id => cart.filter(l => l.product_id === id).reduce((a, l) => a + l.qty, 0);
  const total = () => round2(cart.reduce((a, l) => a + l.qty * l.unit_price, 0));
  const block = S.boot.settings.block_oversell;

  root.innerHTML = `
    ${pendingBanner()}
    <div class="pos">
      <section>
        <div class="pos-head">
          <button class="iconbtn" onclick="go('/')" aria-label="Retour aux services">${icon('back')}</button>
          ${srv.logo ? `<img src="${esc(srv.logo)}" alt="">` : ''}
          <div class="grow"><h1 style="font-size:24px">${esc(srv.name)}</h1><span class="muted small">${srv.type === 'PRESTATION' ? 'Prestations' : 'Vente de produits'}</span></div>
        </div>
        <div class="row" style="margin-bottom:10px"><div class="grow" style="position:relative">
          <input class="input" id="q" placeholder="Rechercher un produit…" style="padding-left:40px" autocomplete="off">
          <span style="position:absolute;left:12px;top:13px;color:var(--faint)">${icon('search')}</span></div></div>
        ${cats.length ? `<div class="chips" id="cats"><button class="chip on" data-cat="all">Tout</button>${cats.map(c => `<button class="chip" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</div>` : ''}
        <div class="prods" id="prods"></div>
      </section>
      <aside class="cart" id="cart"></aside>
    </div>`;

  const drawProds = () => {
    const list = prods();
    $('#prods', root).innerHTML = list.length ? list.map(p => {
      const q = inCart(p.id);
      let stock = '';
      if (tracks(p)) {
        const left = round2(p.stock - q);
        const cls = left <= 0 ? 'out' : (left <= p.min_stock ? 'low' : '');
        stock = `<span class="st ${cls}">${left <= 0 ? 'Rupture' : 'Stock : ' + fmtNum(left)}${cls === 'low' ? ' · faible' : ''}</span>`;
      }
      const dis = tracks(p) && block && p.stock - q <= 0;
      return `<button class="prod" data-p="${esc(p.id)}" ${dis ? 'disabled' : ''}>
        ${q ? `<span class="qbadge">${fmtNum(q)}</span>` : ''}
        <span class="nm">${esc(p.name)}</span>
        <span><span class="pr">${p.price > 0 ? fmtNum(p.price) : 'Prix libre'}</span><br>${stock}</span></button>`;
    }).join('') : `<div class="empty" style="grid-column:1/-1">Aucun produit${st.q ? ' pour « ' + esc(st.q) + ' »' : ''}.</div>`;
    $$('[data-p]', root).forEach(el => el.onclick = () => addProduct(el.dataset.p));
  };

  const drawCart = () => {
    const c = $('#cart', root);
    const n = cart.reduce((a, l) => a + l.qty, 0);
    const editable = l => can('price_edit') || (prodById(l.product_id) || {}).price === 0;
    c.innerHTML = `<span class="handle"></span>
      <div class="cart-h" id="carth"><div class="grow"><h3>${icon('cart')} Panier</h3><span class="muted small">${fmtNum(n)} article(s)<span class="mob"> · <b class="gold">${money(total())}</b></span></span></div>
        <button class="btn primary mob" data-pay ${cart.length ? '' : 'disabled'}>Encaisser</button></div>
      <div class="cart-l">${cart.length ? cart.map((l, i) => `
        <div class="cline"><div><div class="nm">${esc(l.product_name)}</div>
          <div class="muted small">${editable(l) ? `<button class="btn ghost sm" data-price="${i}" style="padding:0;min-height:0">${fmtNum(l.unit_price)} ${icon('edit')}</button>` : fmtNum(l.unit_price)} × ${fmtNum(l.qty)}</div></div>
          <div class="right"><b>${fmtNum(round2(l.qty * l.unit_price))}</b></div>
          <div class="qty"><button data-dec="${i}" aria-label="Moins">−</button><input data-qty="${i}" value="${l.qty}" inputmode="decimal" aria-label="Quantité"><button data-inc="${i}" aria-label="Plus">+</button></div>
          <div class="right"><button class="btn ghost sm" data-del="${i}" aria-label="Retirer">${icon('trash')}</button></div></div>`).join('')
        : `<div class="empty small">Touchez un produit pour l'ajouter.</div>`}</div>
      <div class="cart-f"><div class="total"><span class="muted">Total</span><b>${money(total())}</b></div>
        <button class="btn primary block xl" id="pay" data-pay ${cart.length ? '' : 'disabled'}>Encaisser</button>
        ${cart.length ? `<button class="btn ghost block sm" id="clear" style="margin-top:6px">Vider le panier</button>` : ''}</div>`;
    $('#carth', c).onclick = e => { if (!e.target.closest('[data-pay]')) c.classList.toggle('open'); };
    $$('[data-inc]', c).forEach(b => b.onclick = () => setQty(+b.dataset.inc, cart[+b.dataset.inc].qty + 1));
    $$('[data-dec]', c).forEach(b => b.onclick = () => setQty(+b.dataset.dec, cart[+b.dataset.dec].qty - 1));
    $$('[data-qty]', c).forEach(b => b.onchange = () => setQty(+b.dataset.qty, num(b.value)));
    $$('[data-del]', c).forEach(b => b.onclick = () => { cart.splice(+b.dataset.del, 1); redraw(); });
    $$('[data-price]', c).forEach(b => b.onclick = async () => {
      const l = cart[+b.dataset.price];
      const v = await promptDialog('Prix unitaire', l.product_name, { type: 'number', value: l.unit_price });
      if (v !== null && num(v) >= 0) { l.unit_price = num(v); redraw(); }
    });
    const clr = $('#clear', c); if (clr) clr.onclick = () => { cart.length = 0; redraw(); };
    $$('[data-pay]', c).forEach(b => b.onclick = () => { c.classList.remove('open'); checkout(srv, cart, () => redraw()); });
  };

  const redraw = () => { drawProds(); drawCart(); };

  const setQty = (i, q) => {
    const l = cart[i]; if (!l) return;
    q = round2(q);
    if (q <= 0) { cart.splice(i, 1); return redraw(); }
    const p = prodById(l.product_id);
    if (p && tracks(p) && block) {
      const other = inCart(p.id) - l.qty;
      if (q + other > p.stock) { toast(`Stock insuffisant : ${fmtNum(Math.max(p.stock - other, 0))} disponible(s).`, 'bad'); q = Math.max(p.stock - other, 0); if (q <= 0) { cart.splice(i, 1); return redraw(); } }
    }
    l.qty = q; redraw();
  };

  const addProduct = async (id) => {
    const p = prodById(id);
    if (!p) return;
    if (tracks(p) && block && p.stock - inCart(p.id) <= 0) return toast('Produit en rupture de stock.', 'bad');
    let price = p.price;
    if (!(price > 0)) {
      const v = await promptDialog('Montant de la prestation', p.name, { type: 'number' });
      if (v === null) return;
      price = num(v);
      if (!(price > 0)) return toast('Montant invalide.', 'bad');
      cart.push({ product_id: p.id, product_name: p.name, qty: 1, unit_price: price });
      return redraw();
    }
    const l = cart.find(x => x.product_id === p.id && x.unit_price === price);
    if (l) l.qty = round2(l.qty + 1); else cart.push({ product_id: p.id, product_name: p.name, qty: 1, unit_price: price });
    redraw();
  };

  $('#q', root).addEventListener('input', debounce(e => { st.q = e.target.value.trim(); drawProds(); }, 120));
  const catsEl = $('#cats', root);
  if (catsEl) catsEl.onclick = e => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    st.cat = b.dataset.cat;
    $$('.chip', catsEl).forEach(x => x.classList.toggle('on', x === b));
    drawProds();
  };
  redraw();
  onBootUpdated(() => { if (location.hash.startsWith('#/pos/' + srv.id)) drawProds(); });
}

/* =================== Encaissement =================== */
function parseFields(srv) {
  try { const f = JSON.parse(srv.fields || '[]'); return Array.isArray(f) ? f : []; } catch (e) { return []; }
}

function checkout(srv, cart, after) {
  const total = round2(cart.reduce((a, l) => a + l.qty * l.unit_price, 0));
  const needsProvider = srv.commission_target === 'PRESTATAIRE';
  const providers = S.boot.providers.filter(p => !p.service_id || p.service_id === srv.id);
  const modes = S.boot.payment_modes;
  const extra = parseFields(srv);
  let mode = 'Cash';

  const m = modal('Encaisser', `
    <div class="total" style="margin-bottom:18px"><span class="muted">Total à payer</span><b>${money(total)}</b></div>
    <div class="stack">
      ${needsProvider ? `<label class="f"><span>Prestataire *</span><select class="input" name="provider">${opt(providers.map(p => ({ value: p.id, label: p.name })), '', { blank: 'Choisir…' })}</select></label>
        ${providers.length ? '' : '<p class="bad small">Aucun prestataire actif pour ce service. Demandez à l\'administrateur d\'en ajouter.</p>'}` : ''}
      <div><span class="muted small" style="display:block;margin-bottom:6px">Mode de paiement</span>
        <div class="seg" id="modes">${modes.map(x => `<button type="button" data-mode="${esc(x)}" class="${x === mode ? 'on' : ''}">${esc(x)}</button>`).join('')}</div></div>
      <div id="creditbox" class="hidden grid2">
        <label class="f"><span>Nom du client *</span><input class="input" name="client_cr" autocomplete="off"></label>
        <label class="f"><span>Téléphone</span><input class="input" name="phone" inputmode="tel"></label>
        <label class="f"><span>Acompte versé maintenant</span><input class="input" name="paid" inputmode="decimal" placeholder="0"></label>
      </div>
      <label class="f" id="clientbox"><span>Client (facultatif)</span><input class="input" name="client" autocomplete="off"></label>
      ${extra.map(f => `<label class="f"><span>${esc(f.label || f.key)}</span><input class="input" data-extra="${esc(f.key)}"></label>`).join('')}
      <label class="f"><span>Note (facultatif)</span><input class="input" name="note" autocomplete="off"></label>
      <div class="formerr"></div>
    </div>`, { footer: `<button class="btn ghost" data-close>Annuler</button><button class="btn primary xl" data-ok>Enregistrer la vente</button>` });

  const el = m.el;
  $('#modes', el).onclick = e => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    mode = b.dataset.mode;
    $$('[data-mode]', el).forEach(x => x.classList.toggle('on', x === b));
    $('#creditbox', el).classList.toggle('hidden', mode !== 'Crédit');
    $('#clientbox', el).classList.toggle('hidden', mode === 'Crédit');
  };
  $('[data-ok]', el).onclick = async () => {
    const err = $('.formerr', el);
    err.textContent = '';
    const provSel = $('[name=provider]', el);
    const provider = provSel ? providers.find(p => p.id === provSel.value) : null;
    if (needsProvider && !provider) { err.textContent = 'Choisissez le prestataire.'; return; }
    const client = mode === 'Crédit' ? $('[name=client_cr]', el).value.trim() : $('[name=client]', el).value.trim();
    if (mode === 'Crédit' && !client) { err.textContent = 'Le nom du client est obligatoire pour une vente à crédit.'; return; }
    const paid = mode === 'Crédit' ? num($('[name=paid]', el).value) : 0;
    if (paid < 0 || paid > total) { err.textContent = 'Acompte invalide.'; return; }
    const extraVals = {};
    $$('[data-extra]', el).forEach(i => { if (i.value.trim()) extraVals[i.dataset.extra] = i.value.trim(); });

    const id = uuid();
    const payload = {
      id, ref: makeRef(srv, id), date: nowStr(), service_id: srv.id, service_name: srv.name,
      items: cart.map(l => ({ product_id: l.product_id, product_name: l.product_name, qty: l.qty, unit_price: l.unit_price })),
      payment_mode: mode, client_name: client, client_phone: mode === 'Crédit' ? $('[name=phone]', el).value.trim() : '',
      credit_paid: paid, provider_id: provider ? provider.id : '', provider_name: provider ? provider.name : '',
      note: $('[name=note]', el).value.trim(), extra: Object.keys(extraVals).length ? extraVals : null,
      device_id: deviceId(), offline: !S.online, total
    };
    await recordSale(payload);
    m.close();
    cart.length = 0;
    after && after();
    go('/done/' + id);
  };
}

function makeRef(srv, id) {
  return (srv.code || 'JB') + '-' + dayStr().replace(/-/g, '').slice(2) + '-' + id.replace(/-/g, '').slice(0, 5).toUpperCase();
}

/** Enregistre localement d'abord (toujours), puis tente l'envoi. */
async function recordSale(payload) {
  const op = await enqueue('sale', payload);
  (payload.items || []).forEach(it => { const p = prodById(it.product_id); if (p) p.stock = round2(p.stock - it.qty); });
  await saveBoot();
  await addToLocalHistory(op, false);
  syncSoon(100);
  return op;
}

/* =================== Recharge téléphonique =================== */
function viewRecharge(root, srv) {
  const ops = S.boot.products.filter(p => p.service_id === srv.id && p.active);
  let sel = ops[0] ? ops[0].id : '', mode = 'Cash';
  root.innerHTML = `
    ${pendingBanner()}
    <div style="max-width:560px;margin:0 auto">
      <div class="pos-head"><button class="iconbtn" onclick="go('/')" aria-label="Retour">${icon('back')}</button>
        <div class="grow"><h1 style="font-size:24px">${esc(srv.name)}</h1><span class="muted small">Recharge téléphonique</span></div></div>
      ${ops.length ? `<div class="card stack">
        <div><span class="muted small" style="display:block;margin-bottom:6px">Opérateur</span><div class="seg" id="ops">${ops.map(o => `<button type="button" data-op="${esc(o.id)}" class="${o.id === sel ? 'on' : ''}">${esc(o.name)}</button>`).join('')}</div>
          <p class="small muted" id="bal" style="margin:8px 0 0"></p></div>
        <label class="f"><span>Montant de la recharge *</span><input class="input" id="amt" inputmode="decimal" placeholder="Ex. 250" style="font-size:22px;min-height:56px"></label>
        <label class="f"><span>Numéro du client</span><input class="input" id="phone" inputmode="tel" placeholder="Ex. 3712 3456"></label>
        <div><span class="muted small" style="display:block;margin-bottom:6px">Paiement</span><div class="seg" id="modes">${S.boot.payment_modes.filter(x => x !== 'Crédit').map(x => `<button type="button" data-mode="${esc(x)}" class="${x === mode ? 'on' : ''}">${esc(x)}</button>`).join('')}</div></div>
        <div class="total"><span class="muted">Total</span><b id="tot">${money(0)}</b></div>
        <div class="formerr"></div>
        <button class="btn primary block xl" id="go">Enregistrer la recharge</button></div>`
      : `<div class="empty card"><h3>Aucun opérateur configuré</h3><p>L'administrateur doit ajouter les soldes Digicel / Natcom dans les produits.</p></div>`}
    </div>`;
  if (!ops.length) return;
  const prod = () => prodById(sel);
  const upd = () => {
    const p = prod();
    $('#bal', root).innerHTML = p.track_stock ? `Solde disponible : <b class="${p.stock <= p.min_stock ? 'warn' : 'gold'}">${money(p.stock)}</b>` : '';
    $('#tot', root).textContent = money(round2(num($('#amt', root).value) * (p.price || 1)));
  };
  $('#ops', root).onclick = e => { const b = e.target.closest('[data-op]'); if (!b) return; sel = b.dataset.op; $$('[data-op]', root).forEach(x => x.classList.toggle('on', x === b)); upd(); };
  $('#modes', root).onclick = e => { const b = e.target.closest('[data-mode]'); if (!b) return; mode = b.dataset.mode; $$('[data-mode]', root).forEach(x => x.classList.toggle('on', x === b)); };
  $('#amt', root).oninput = upd;
  $('#go', root).onclick = async () => {
    const err = $('.formerr', root);
    const p = prod(), amt = num($('#amt', root).value);
    if (!(amt > 0)) { err.textContent = 'Saisissez le montant de la recharge.'; return; }
    if (p.track_stock && S.boot.settings.block_oversell && amt > p.stock) { err.textContent = `Solde ${p.name} insuffisant (${money(p.stock)}).`; return; }
    const id = uuid();
    const phone = $('#phone', root).value.trim();
    await recordSale({
      id, ref: makeRef(srv, id), date: nowStr(), service_id: srv.id, service_name: srv.name,
      items: [{ product_id: p.id, product_name: 'Recharge ' + p.name, qty: amt, unit_price: p.price || 1 }],
      payment_mode: mode, client_name: '', client_phone: phone, note: phone ? 'N° ' + phone : '',
      extra: phone ? { numero: phone } : null, device_id: deviceId(), offline: !S.online, total: round2(amt * (p.price || 1))
    });
    go('/done/' + id);
  };
  upd();
}

/* =================== Confirmation et reçu =================== */
async function findSale(id) {
  const op = await DB.get('outbox', id);
  if (op) return { sale: op.payload, pending: op.status === 'pending', error: op.status === 'error' ? op.error : '' };
  const h = (await DB.get('kv', 'hist:' + S.acc.user.id)) || [];
  const s = h.find(x => x.id === id);
  return s ? { sale: s, pending: false } : null;
}

function receiptHtml(s) {
  const st = S.boot.settings;
  const items = s.items || [];
  return `<div class="receipt print-area">
    <h3>${esc(st.company_name)}</h3>
    <p style="text-align:center;margin:2px 0 10px;font-size:12px">${esc(s.service_name || '')}<br>${fmtDate(s.date)} · Réf. ${esc(s.ref)}</p>
    <table>${items.map(i => `<tr><td>${esc(i.product_name)}<br><small>${fmtNum(i.qty)} × ${fmtNum(i.unit_price)}</small></td><td style="text-align:right">${fmtNum(i.total !== undefined ? i.total : i.qty * i.unit_price)}</td></tr>`).join('')}
    <tr class="tot"><td>TOTAL</td><td style="text-align:right">${money(s.total)}</td></tr></table>
    <p style="font-size:12px;margin:8px 0 0">Paiement : ${esc(s.payment_mode)}${s.client_name ? '<br>Client : ' + esc(s.client_name) : ''}${s.provider_name ? '<br>Prestataire : ' + esc(s.provider_name) : ''}</p>
    ${st.receipt_footer ? `<p style="text-align:center;font-size:12px;margin:12px 0 0">${esc(st.receipt_footer)}</p>` : ''}</div>`;
}

function receiptText(s) {
  const st = S.boot.settings;
  return [st.company_name, (s.service_name || '') + ' — ' + fmtDate(s.date), 'Réf. ' + s.ref, '',
    ...(s.items || []).map(i => `${i.product_name} ${fmtNum(i.qty)} x ${fmtNum(i.unit_price)} = ${fmtNum(i.qty * i.unit_price)}`),
    '', 'TOTAL : ' + money(s.total), 'Paiement : ' + s.payment_mode, st.receipt_footer || ''].join('\n');
}

async function shareReceipt(s) {
  const text = receiptText(s);
  try {
    if (navigator.share) await navigator.share({ title: 'Reçu ' + s.ref, text });
    else { await navigator.clipboard.writeText(text); toast('Reçu copié.', 'ok'); }
  } catch (e) { /* annulé */ }
}

async function viewDone(root, id) {
  const r = await findSale(id);
  if (!r) { go('/'); return; }
  const s = r.sale;
  const draw = (pending, error) => {
    root.innerHTML = `<div class="confirm">
      <div class="seal">${icon('check')}</div>
      <h1>Vente enregistrée</h1>
      <p class="muted" style="margin:6px 0 0">Réf. ${esc(s.ref)} · <b class="gold">${money(s.total)}</b></p>
      <p style="margin:12px 0 0">${error ? `<span class="tag bad">Refusée : ${esc(error)}</span>` : pending ? `<span class="tag warn">En attente d'envoi — elle partira automatiquement</span>` : `<span class="tag ok">Synchronisée avec le serveur</span>`}</p>
      ${receiptHtml(s)}
      <div class="stack no-print">
        <button class="btn primary block xl" id="again">Nouvelle vente</button>
        <div class="row"><button class="btn grow" id="print">${icon('print')} Imprimer</button><button class="btn grow" id="share">${icon('share')} Partager</button></div>
        <button class="btn ghost block" onclick="go('/')">Retour aux services</button>
      </div></div>`;
    $('#again', root).onclick = () => go('/pos/' + s.service_id);
    $('#print', root).onclick = () => window.print();
    $('#share', root).onclick = () => shareReceipt(s);
  };
  draw(r.pending, r.error);
  const onSync = async () => {
    if (!location.hash.startsWith('#/done/' + id)) return document.removeEventListener('synced', onSync);
    const x = await findSale(id);
    if (x) draw(x.pending, x.error);
  };
  document.addEventListener('synced', onSync);
}

/* =================== Historique du vendeur =================== */
async function viewHistory(root) {
  const maxDays = S.boot.settings.vendor_history_days || 7;
  const all = can('sales_all');
  let day = dayStr();
  const minDay = addDays(dayStr(), -(maxDays - 1));

  const load = async () => {
    root.querySelector('#hl').innerHTML = '<div class="loading"><span class="spin"></span></div>';
    let list = [];
    let fromServer = false;
    try {
      const r = await call('my_sales', { from: day, to: day }, { timeout: 20000 });
      list = r.sales;
      fromServer = true;
      // mise à jour du cache local
      const key = 'hist:' + S.acc.user.id;
      const h = ((await DB.get('kv', key)) || []).filter(x => String(x.date).slice(0, 10) !== day);
      await DB.put('kv', h.concat(list.map(x => Object.assign(x, { synced: true }))), key);
    } catch (e) {
      const h = (await DB.get('kv', 'hist:' + S.acc.user.id)) || [];
      list = h.filter(x => String(x.date).slice(0, 10) === day);
    }
    const pend = (await DB.all('outbox')).filter(o => o.type === 'sale' && o.user_id === S.acc.user.id && String(o.payload.date).slice(0, 10) === day);
    const ids = new Set(list.map(x => x.id));
    pend.forEach(o => {
      const p = o.payload;
      const row = { id: o.id, ref: p.ref, date: p.date, service_name: p.service_name, payment_mode: p.payment_mode, total: p.total, status: o.status === 'error' ? 'REFUSEE' : 'EN_ATTENTE', items: p.items, client_name: p.client_name, provider_name: p.provider_name };
      if (ids.has(o.id)) list = list.map(x => x.id === o.id ? row : x); else list.push(row);
    });
    list.sort((a, b) => a.date < b.date ? 1 : -1);
    const valid = list.filter(x => x.status !== 'ANNULEE' && x.status !== 'REFUSEE');
    const tot = round2(valid.reduce((a, x) => a + x.total, 0));
    const com = round2(valid.reduce((a, x) => a + (x.commission_total || 0), 0));
    root.querySelector('#hs').innerHTML = `<div class="kpi lead"><div class="l">Total ${day === dayStr() ? 'aujourd\'hui' : 'du ' + fmtDay(day)}</div><div class="v">${money(tot)}</div><div class="d muted">${valid.length} vente(s)${com ? ' · commission ' + money(com) : ''}${fromServer ? '' : ' · données de l\'appareil'}</div></div>`;
    const tag = r => r.status === 'EN_ATTENTE' ? '<span class="tag warn">En attente</span>' : r.status === 'ANNULEE' ? '<span class="tag bad">Annulée</span>' : r.status === 'REFUSEE' ? '<span class="tag bad">Refusée</span>' : '<span class="tag ok">OK</span>';
    root.querySelector('#hl').innerHTML = list.length ? `<div class="card" style="padding:0">${list.map((r, i) => `
      <div class="hrow" data-row="${i}"><span class="tm">${esc(String(r.date).slice(11, 16))}</span>
        <div class="grow"><b>${esc(r.service_name || '')}</b> <span class="muted small">· ${esc(r.payment_mode)}</span>
          <div class="it">${esc((r.items || []).map(x => x.product_name + ' ×' + fmtNum(x.qty)).join(', '))}</div></div>
        <div class="right"><b>${fmtNum(r.total)}</b><div style="margin-top:4px">${tag(r)}</div></div></div>`).join('')}</div>`
      : '<div class="empty card flat">Aucune vente ce jour-là.</div>';
    $$('[data-row]', root.querySelector('#hl')).forEach(el => el.addEventListener('click', () => openSale(list[+el.dataset.row])));
    const openSale = s => {
      const m = modal('Vente ' + s.ref, receiptHtml(s), { footer: `<button class="btn" data-print>${icon('print')} Imprimer</button><button class="btn" data-share>${icon('share')} Partager</button><button class="btn primary" data-close>Fermer</button>` });
      m.el.querySelector('[data-print]').onclick = () => window.print();
      m.el.querySelector('[data-share]').onclick = () => shareReceipt(s);
    };
  };

  root.innerHTML = `
    <div class="page-h"><button class="iconbtn" onclick="go('/')" aria-label="Retour">${icon('back')}</button><h1>Mes ventes</h1>
      <input type="date" class="input" id="day" value="${day}" ${all ? '' : `min="${minDay}"`} max="${dayStr()}" style="max-width:180px"></div>
    <div class="kpis" id="hs"></div><div id="hl"></div>
    ${all ? '' : `<p class="faint small" style="margin-top:12px">Vous pouvez consulter les ${maxDays} derniers jours.</p>`}`;
  $('#day', root).onchange = e => { day = e.target.value || dayStr(); if (!all && day < minDay) day = minDay; load(); };
  await load();
  document.addEventListener('synced', function h() { if (location.hash !== '#/history') return document.removeEventListener('synced', h); load(); });
}

/* =================== Dépense rapide (hors ligne) =================== */
function viewExpense(root) {
  const cats = S.boot.settings.expense_categories || [];
  const fields = [
    { k: 'amount', label: 'Montant', type: 'number', req: true, min: 0 },
    { k: 'category', label: 'Catégorie', type: 'select', options: cats, req: true },
    { k: 'service_id', label: 'Service concerné', type: 'select', options: S.boot.services.map(s => ({ value: s.id, label: s.name })), blank: 'Général' },
    { k: 'payment_mode', label: 'Payé par', type: 'select', options: ['Cash', 'MonCash', 'NatCash'] },
    { k: 'date', label: 'Date', type: 'date', def: dayStr() },
    { k: 'responsible', label: 'Responsable', def: S.acc.user.name },
    { k: 'description', label: 'Description', type: 'textarea', full: true }
  ];
  root.innerHTML = `<div style="max-width:620px;margin:0 auto">
    <div class="page-h"><button class="iconbtn" onclick="go('/')" aria-label="Retour">${icon('back')}</button><h1>Nouvelle dépense</h1></div>
    <div class="card">${formHtml(fields)}<button class="btn primary block xl" id="save" style="margin-top:16px">Enregistrer la dépense</button></div></div>`;
  $('#save', root).onclick = async () => {
    const err = $('.formerr', root);
    try {
      const v = formRead(root, fields);
      if (!(v.amount > 0)) throw new Error('Le montant doit être supérieur à 0.');
      await enqueue('expense', v);
      syncSoon(100);
      toast(S.online ? 'Dépense enregistrée.' : 'Dépense enregistrée sur l\'appareil, envoi au retour d\'internet.', 'ok');
      go('/');
    } catch (e) { err.textContent = e.message; }
  };
}

/* =================== Encaisser un crédit (hors ligne) =================== */
function viewCollect(root) {
  let q = '';
  const draw = () => {
    const list = (S.boot.credits || []).filter(c => c.balance > 0 && (!q || (c.client + ' ' + (c.phone || '') + ' ' + (c.ref || '')).toLowerCase().includes(q)))
      .sort((a, b) => a.client.localeCompare(b.client));
    $('#cl', root).innerHTML = tableHtml([
      { k: 'client', label: 'Client' }, { k: 'phone', label: 'Téléphone' }, { k: 'date', label: 'Date', fmt: fmtDay },
      { k: 'amount', label: 'Montant', num: true, fmt: fmtNum }, { k: 'balance', label: 'Reste à payer', num: true, html: r => `<b class="gold">${fmtNum(r.balance)}</b>` }
    ], list, { empty: 'Aucun crédit en cours.', click: true });
    bindRows(root, list, c => {
      const f = [{ k: 'amount', label: 'Montant reçu', type: 'number', req: true, def: c.balance }, { k: 'payment_mode', label: 'Mode', type: 'select', options: ['Cash', 'MonCash', 'NatCash'] }, { k: 'note', label: 'Note' }];
      formModal(`Paiement — ${c.client}`, f, {}, async v => {
        if (!(v.amount > 0)) throw new Error('Montant invalide.');
        if (v.amount > c.balance) throw new Error('Le montant dépasse le reste à payer (' + money(c.balance) + ').');
        await enqueue('credit_payment', { credit_id: c.id, amount: v.amount, payment_mode: v.payment_mode, note: v.note, date: nowStr() });
        c.balance = round2(c.balance - v.amount);
        await saveBoot();
        syncSoon(100);
        toast('Paiement enregistré.', 'ok');
        draw();
      }, { okLabel: 'Encaisser', extra: `<p class="muted small">Reste à payer : <b class="gold">${money(c.balance)}</b></p>` });
    });
  };
  root.innerHTML = `<div class="page-h"><button class="iconbtn" onclick="go('/')" aria-label="Retour">${icon('back')}</button><h1>Encaisser un crédit</h1></div>
    <input class="input" id="cq" placeholder="Rechercher un client…" style="margin-bottom:12px"><div id="cl"></div>`;
  $('#cq', root).oninput = debounce(e => { q = e.target.value.trim().toLowerCase(); draw(); }, 120);
  draw();
}

/* =================== Mon compte =================== */
async function viewAccount(root) {
  const u = S.acc.user;
  const ops = (await DB.all('outbox')).sort((a, b) => a.created_at - b.created_at);
  const label = { sale: 'Vente', expense: 'Dépense', credit_payment: 'Paiement de crédit' };
  root.innerHTML = `<div style="max-width:760px;margin:0 auto" class="stack">
    <div class="page-h"><button class="iconbtn" onclick="go('/')" aria-label="Retour">${icon('back')}</button><h1>Mon compte</h1></div>
    <div class="card"><h2>${esc(u.name)}</h2><p class="muted" style="margin:4px 0 0">${esc(u.username)} · ${esc(u.role_label)}${u.title ? ' · ' + esc(u.title) : ''}</p></div>
    <div class="card stack">
      <div class="row"><h3 class="grow">Synchronisation</h3><button class="btn sm" id="syncbtn">${icon('sync')} Synchroniser</button></div>
      <p class="muted small" style="margin:0">${S.online ? 'Connecté à internet.' : 'Hors ligne.'} ${S.lastSync ? 'Dernière tentative : ' + new Date(S.lastSync).toLocaleTimeString('fr-FR') : ''}</p>
      ${ops.length ? tableHtml([
        { k: 'type', label: 'Opération', fmt: v => label[v] || v },
        { k: 'username', label: 'Compte' },
        { k: 'created_at', label: 'Créée', fmt: v => new Date(v).toLocaleString('fr-FR') },
        { k: 'payload', label: 'Montant', num: true, fmt: v => fmtNum(v.total || v.amount || 0) },
        { k: 'status', label: 'État', html: r => r.status === 'error' ? `<span class="tag bad">Refusée</span><div class="small bad">${esc(r.error)}</div>` : `<span class="tag warn">En attente</span>${r.error ? `<div class="small faint">${esc(r.error)}</div>` : ''}` },
        { k: 'id', label: '', html: r => r.status === 'error' ? `<button class="btn danger sm" data-drop="${esc(r.id)}">Supprimer</button> <button class="btn sm" data-retry="${esc(r.id)}">Réessayer</button>` : '' }
      ], ops) : '<p class="ok" style="margin:0">Tout est synchronisé.</p>'}
    </div>
    <div class="card stack"><h3>Mot de passe</h3><button class="btn" id="pwd">${icon('lock')} Changer mon mot de passe</button></div>
    <div class="card stack"><h3>Appareil</h3>
      <p class="muted small" style="margin:0">Identifiant : ${esc(deviceId())} · Version ${esc(CFG.APP_VERSION)}</p>
      <div class="row wrap"><button class="btn" id="lock">${icon('users')} Changer d'utilisateur</button><button class="btn danger" id="out">${icon('logout')} Se déconnecter</button></div>
      <p class="faint small" style="margin:0">« Changer d'utilisateur » garde vos données sur l'appareil : vous pourrez vous reconnecter même sans internet.</p></div>
  </div>`;
  $('#syncbtn', root).onclick = async () => { await syncNow({ manual: true }); viewAccount(root); };
  $$('[data-drop]', root).forEach(b => b.onclick = async () => {
    if (!await confirmDialog('Supprimer l\'opération', 'Cette opération a été refusée par le serveur. La supprimer définitivement de l\'appareil ?', 'Supprimer', true)) return;
    await DB.del('outbox', b.dataset.drop); await countPending(); viewAccount(root);
  });
  $$('[data-retry]', root).forEach(b => b.onclick = async () => {
    const op = await DB.get('outbox', b.dataset.retry); op.status = 'pending'; op.error = ''; await DB.put('outbox', op);
    await syncNow({ manual: true }); viewAccount(root);
  });
  $('#pwd', root).onclick = () => {
    const f = [{ k: 'old_password', label: 'Mot de passe actuel', type: 'password', req: true, full: true }, { k: 'new_password', label: 'Nouveau mot de passe (6 caractères min.)', type: 'password', req: true, full: true }, { k: 'confirm', label: 'Confirmer', type: 'password', req: true, full: true }];
    formModal('Changer mon mot de passe', f, {}, async v => {
      if (v.new_password !== v.confirm) throw new Error('Les deux mots de passe ne correspondent pas.');
      await call('change_password', v);
      S.acc.verifier = await makeVerifier(v.new_password).catch(() => null);
      await DB.put('accounts', S.acc);
      toast('Mot de passe modifié.', 'ok');
    });
  };
  $('#lock', root).onclick = () => lockDevice();
  $('#out', root).onclick = () => fullLogout();
}
