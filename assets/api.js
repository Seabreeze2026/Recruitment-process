// Apps Script API ilə əlaqə və ümumi köməkçi funksiyalar
(function () {
  const cfg = window.APP_CONFIG || {};
  const API_URL = (new URLSearchParams(location.search).get('api')) || cfg.API_URL;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* yaddaş əlçatmazdır */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } }
  };

  let pending = 0;
  function loader(on) {
    pending += on ? 1 : -1;
    let el = document.getElementById('loader');
    if (pending > 0 && !el) { el = document.createElement('div'); el.id = 'loader'; el.className = 'loader'; document.body.appendChild(el); }
    if (pending <= 0 && el) el.remove();
  }

  async function call(action, data) {
    if (!API_URL || /BURAYA/.test(API_URL)) throw new Error('API ünvanı təyin olunmayıb (assets/config.js faylına baxın).');
    loader(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, data: data || {}, token: store.get('rp_token') || '' }),
        redirect: 'follow'
      });
      const json = await res.json();
      if (!json.ok) {
        const err = new Error(String(json.error || 'Naməlum xəta').replace(/^AUTH: /, ''));
        if (/^AUTH:/.test(json.error || '')) err.auth = true;
        if (/^DUPLICATE:/.test(json.error || '')) {
          const p = json.error.split(':');
          err.duplicateId = p[1];
          err.message = p.slice(2).join(':');
        }
        throw err;
      }
      return json.data;
    } catch (e) {
      if (e instanceof TypeError) throw new Error('Serverlə əlaqə qurulmadı. İnterneti yoxlayın və yenidən cəhd edin.');
      throw e;
    } finally { loader(false); }
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toast(msg, bad) {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), bad ? 6000 : 3200);
  }

  window.RP = { call, esc, toast, store, API_URL };
})();
