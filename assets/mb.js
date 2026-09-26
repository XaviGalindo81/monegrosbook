/* MonegrosBook · web del equipo · utilidades comunes (clave, API, refresco en vivo) */
window.MB = (function () {
  var API = 'https://script.google.com/macros/s/AKfycbzFak0kBBUvmy61KyJp4U7I3UPwfkc5zhBcqmUd4mF3EykODIMwJluFD8Qcz4PHd0XI/exec';
  var LS = 'mb_key';
  function getKey() { try { return localStorage.getItem(LS) || ''; } catch (e) { return ''; } }
  function setKey(k) { try { k ? localStorage.setItem(LS, k) : localStorage.removeItem(LS); } catch (e) {} }

  async function call(action, data) {
    var body = Object.assign({ action: action, key: getKey() }, data || {});
    var r = await fetch(API, { method: 'POST', body: JSON.stringify(body), redirect: 'follow' });
    var j = await r.json();
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
      async function tryKey(k, silent) {
        setKey(k);
        try {
          var j = await call('login');
          if (need === 'gestion' && j.role !== 'gestion') { setKey(''); if (!silent) err.textContent = 'Esta clave no abre la parte de gestión.'; return false; }
          ov.remove(); resolve(j.role); return true;
        } catch (e) {
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
