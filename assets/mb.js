/* MonegrosBook · web del equipo · utilidades comunes (clave, API, refresco en vivo) */
window.MB = (function () {
var API = 'https://script.google.com/macros/s/AKfycbzFak0kBBUvmy61KyJp4U7I3UPwfkc5zhBcqmUd4mF3EykODIMwJluFD8Qcz4PHd0XI/exec';
var LS = 'mb_key';
function getKey() { try { return localStorage.getItem(LS) || ''; } catch (e) { return ''; } }
function setKey(k) { try { k ? localStorage.setItem(LS, k) : localStorage.removeItem(LS); } catch (e) {} }

// Llamadas a la API (28/09): las lecturas van por GET y las escrituras por POST.
// Google (Apps Script) a veces tarda o devuelve una página de error aunque el script haya
// terminado bien: cada llamada tiene tiempo límite y se reintenta sola.
var MB_GET = { login: 1, tablon: 1, areas: 1, vol: 1, aloj: 1 };
function mbPlano(o) { for (var k in o) { var v = o[k]; if (v !== null && typeof v === 'object') return false; } return true; }
function mbFetch(url, opt, ms) {
  var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, ms);
  return fetch(url, Object.assign({ signal: c.signal, redirect: 'follow' }, opt || {})).finally(function () { clearTimeout(t); });
}
async function mbIntento(action, body) {
  var r;
  if (MB_GET[action] && mbPlano(body)) {
    var q = Object.keys(body).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(body[k] == null ? '' : body[k]); }).join('&');
    r = await mbFetch(API + '?' + q, { method: 'GET', cache: 'no-store' }, 12000);
  } else {
    r = await mbFetch(API, { method: 'POST', body: JSON.stringify(body) }, 30000);
  }
  var tx = await r.text();
  try { return JSON.parse(tx); } catch (e) { throw new Error('red'); }
}
async function call(action, data) {
  var body = Object.assign({ action: action, key: getKey() }, data || {});
  var reintentos = (action === 'aloj.add' || action === 'area.load') ? 0 : 3;
  var j = null, last = null;
  for (var i = 0; i <= reintentos; i++) {
    try { j = await mbIntento(action, body); break; }
    catch (e) { last = e; if (i < reintentos) await new Promise(function (res) { setTimeout(res, 600 * (i + 1)); }); }
  }
  if (!j) throw last;
  if (!j.ok) { var e = new Error(j.msg || j.error || 'error'); e.code = j.error; throw e; }
  return j;
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

function toast(t) {
var e = document.getElementById('mb-toast');
if (!e) { e = document.createElement('div'); e.id = 'mb-toast'; e.className = 'mb-toast'; document.body.appendChild(e); }
e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { e.hidden = true; }, 2600);
}

// Pide la clave (need: 'gestion' | 'any'). Resuelve con el rol.
function gate(opts) {
opts = opts || {};
var need = opts.need || 'any';
return new Promise(function (resolve) {
var ov = document.createElement('div');
ov.className = 'mb-gate';
ov.innerHTML = '<form class="mb-gate-box" autocomplete="off">' +
'<div class="mb-logo"></div>' +
'<p class="mb-gate-k">MonegrosBook · acceso</p>' +
'<h2>' + esc(opts.title || 'Clave') + '</h2>' +
'<label for="mb-pw">' + esc(opts.label || (need === 'gestion' ? 'Clave de gestión' : 'Clave del equipo o de voluntarios')) + '</label>' +
'<input id="mb-pw" type="text" autocapitalize="characters" spellcheck="false" placeholder="CLAVE">' +
'<p class="mb-gate-err" aria-live="polite"></p>' +
'<div class="mb-gate-row"><a href="../">← Menú</a><button type="submit">Entrar</button></div>' +
'<p class="mb-gate-hint">Se recuerda en este dispositivo. Los cambios que hagas los ve todo el equipo al momento.</p></form>';
var pw = ov.querySelector('#mb-pw'), err = ov.querySelector('.mb-gate-err'), f = ov.querySelector('form');
var slowT = null;
function clearSlowTimer(){ if (slowT) { clearTimeout(slowT); slowT = null; } }
async function tryKey(k, silent) {
setKey(k);
try {
var j = await call('login');
clearSlowTimer();
if (need === 'gestion' && j.role !== 'gestion') { setKey(''); if (!silent) err.textContent = 'Esta clave no abre la parte de gestión.'; return false; }
ov.remove(); resolve(j.role); return true;
} catch (e) {
clearSlowTimer();
setKey('');
if (!silent) err.textContent = e.code === 'clave' ? 'Clave incorrecta.' : 'No se puede conectar. Revisa la conexión y prueba otra vez.';
return false;
}
}
f.addEventListener('submit', function (ev) {
ev.preventDefault();
var k = pw.value.trim().toUpperCase();
if (!k) { err.textContent = 'Escribe la clave.'; return; }
err.textContent = 'Comprobando…';
clearSlowTimer();
slowT = setTimeout(function () { err.textContent = 'Comprobando… puede tardar unos segundos si hay poca cobertura.'; }, 1800);
tryKey(k);
});
var saved = getKey();
if (saved) {
tryKey(saved, true).then(function (ok) { if (!ok) { document.body.appendChild(ov); pw.focus(); } });
} else { document.body.appendChild(ov); setTimeout(function () { pw.focus(); }, 30); }
});
}

function logout() { setKey(''); location.reload(); }

// Refresco periódico (solo con la pestaña visible)
function poll(fn, ms) {
var t = null;
function tick() { if (!document.hidden) fn(); }
t = setInterval(tick, ms || 30000);
document.addEventListener('visibilitychange', function () { if (!document.hidden) fn(); });
return function () { clearInterval(t); };
}

function hm(ts) { var d = new Date(ts); return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
function slug(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'sin-nombre'; }

return { call: call, gate: gate, logout: logout, poll: poll, toast: toast, esc: esc, hm: hm, slug: slug, getKey: getKey };
})();
