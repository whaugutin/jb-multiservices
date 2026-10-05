/* JB Multiservices — routeur et démarrage */
'use strict';

let routeCleanups = [];
function onRouteLeave(fn) { routeCleanups.push(fn); }
function onBootUpdated(fn) {
  const h = () => fn();
  document.addEventListener('boot-updated', h);
  onRouteLeave(() => document.removeEventListener('boot-updated', h));
}

function go(path) {
  const h = '#' + path;
  if (location.hash === h) route(); else location.hash = h;
}

function topBar() {
  const u = S.acc.user;
  const st = S.boot ? S.boot.settings : {};
  return `<header class="top no-print"><div class="top-in">
    <a class="brand" href="#/"><img src="${esc(st.logo || LOGO)}" alt=""><b>${esc(st.company_name || 'JB Multiservices')}</b></a>
    <span class="grow"></span>
    <button class="pill" id="syncpill" title="Synchroniser maintenant"></button>
    <button class="iconbtn" id="acct" aria-label="Mon compte" title="${esc(u.name)}">${icon('user')}</button>
  </div></header>`;
}

function viewLogin(root, params) {
  const pre = params.get('u') || '';
  root.innerHTML = `<div class="login"><div class="login-box">
    <img class="emb" src="${LOGO}" alt="JB Multiservices">
    <h1>JB Multiservices</h1>
    <p class="muted" style="margin:0">Gestion des ventes et des services</p>
    <form class="stack" id="lf" autocomplete="on">
      <label class="f"><span>Identifiant</span><input class="input" name="u" autocomplete="username" autocapitalize="none" value="${esc(pre)}" required></label>
      <label class="f"><span>Mot de passe</span><input class="input" name="p" type="password" autocomplete="current-password" required></label>
      <div class="formerr" id="le"></div>
      <button class="btn primary block xl" id="lb">Se connecter</button>
      <p class="faint small center" id="lo">${S.online ? '' : 'Hors ligne : seuls les comptes déjà utilisés sur cet appareil peuvent se connecter.'}</p>
    </form></div></div>`;
  const f = $('#lf', root);
  $(pre ? '[name=p]' : '[name=u]', f).focus();
  f.onsubmit = async e => {
    e.preventDefault();
    const btn = $('#lb', root), err = $('#le', root);
    err.textContent = '';
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    try {
      const r = await loginFlow(f.u.value, f.p.value);
      if (r.offline) toast('Connecté hors ligne. Les ventes seront envoyées au retour d\'internet.');
      syncSoon(500);
      go('/');
    } catch (e2) {
      err.textContent = e2.message;
    } finally { btn.disabled = false; btn.textContent = 'Se connecter'; }
  };
}

async function route() {
  routeCleanups.forEach(f => { try { f(); } catch (e) { } });
  routeCleanups = [];
  window.scrollTo(0, 0);
  const app = $('#app');
  const raw = (location.hash || '#/').slice(1);
  const [path, qs] = raw.split('?');
  const params = new URLSearchParams(qs || '');
  const parts = path.split('/').filter(Boolean);

  if (parts[0] === 'login' || !S.acc) {
    if (S.acc) return go('/');
    return viewLogin(app, params);
  }
  if (!S.boot) {
    app.innerHTML = topBar() + '<main><div class="loading"><span class="spin"></span></div></main>';
    renderSyncPill();
    await refreshBoot({ silent: false });
    if (!S.boot) {
      $('main', app).innerHTML = `<div class="empty card"><h3>Données indisponibles</h3><p>Connectez-vous à internet une première fois pour charger le catalogue.</p><button class="btn" onclick="route()">Réessayer</button></div>`;
      return;
    }
  }
  app.innerHTML = topBar() + '<main id="view"></main>';
  renderSyncPill();
  $('#syncpill').onclick = () => syncNow({ manual: true });
  $('#acct').onclick = () => go('/account');
  const v = $('#view');
  try {
    switch (parts[0] || '') {
      case '': return viewHome(v);
      case 'pos': return viewPos(v, parts[1]);
      case 'done': return await viewDone(v, parts[1]);
      case 'history': return await viewHistory(v);
      case 'expense': return can('expenses') ? viewExpense(v) : go('/');
      case 'collect': return can('credits') ? viewCollect(v) : go('/');
      case 'account': return await viewAccount(v);
      case 'admin': return await viewAdmin(v, parts[1]);
      default: return go('/');
    }
  } catch (e) {
    console.error(e);
    v.innerHTML = `<div class="empty card"><h3>Une erreur est survenue</h3><p>${esc(e.message)}</p><button class="btn" onclick="go('/')">Retour à l'accueil</button></div>`;
  }
}

window.addEventListener('hashchange', route);

async function init() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker indisponible :', e));
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  try {
    const cur = await DB.get('kv', 'current');
    if (cur) {
      const acc = await DB.get('accounts', cur);
      if (acc && !acc.needsLogin) {
        S.acc = acc;
        S.boot = await DB.get('kv', 'boot:' + acc.user.id) || null;
        refreshBoot({ silent: true }).then(() => { if (/^#\/?$/.test(location.hash || '#/')) route(); });
      }
    }
  } catch (e) {
    console.error(e);
    toast('Stockage local indisponible : le mode hors ligne ne fonctionnera pas sur cet appareil.', 'bad');
  }
  await countPending().catch(() => { });
  route();
  syncSoon(1500);
}

init();
