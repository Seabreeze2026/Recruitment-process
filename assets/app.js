/* İşə qəbul platforması — web interfeys */
(function () {
  'use strict';
  const { call, esc, toast, store } = window.RP;

  /* ======================= SABİTLƏR ======================= */
  const STAGES = ['Müraciət', 'İlkin söhbət', 'Müsahibə', 'Tapşırıq', 'Final', 'Təklif', 'İşə qəbul', 'İmtina'];
  const CLOSED = ['İşə qəbul', 'İmtina'];
  const V_STATUSES = ['Açıq', 'Dayandırılıb', 'Bağlandı', 'Ləğv edildi'];
  const DIFFICULTY = ['Asan', 'Orta', 'Çətin'];
  const PRIORITY = ['Aşağı', 'Normal', 'Yüksək', 'Təcili'];
  const ATTENDANCE = ['İştirak edib', 'İştirak etməyib'];
  const RECS = ['Tövsiyə edirəm', 'Tərəddüd edirəm', 'Tövsiyə etmirəm'];
  const METRICS = {
    P1: { name: 'Vaxtında bağlanma faizi', desc: 'Dövrdə bağlanan vakansiyalardan neçə faizi son tarixə qədər doldurulub. Son tarix yoxdursa, çətinlik dərəcəsinə görə hədəf gün götürülür.', lower: false },
    P2: { name: 'Orta bağlanma müddəti', desc: 'Vakansiyanın açılmasından namizədin təklifi qəbul etdiyi günə qədər keçən gün (dayandırılmış günlər çıxılır). Hədəf çətinlik dərəcəsinə görədir.', lower: true },
    P3: { name: 'Təklifin qəbul faizi', desc: 'Cavab verilmiş təkliflərdən neçə faizi qəbul olunub.', lower: false },
    P4: { name: 'Sınaq müddətini keçmə faizi', desc: 'Sınaq müddəti dövrdə bitən işçilərdən neçə faizi sınağı keçib (işə qəbulun keyfiyyəti).', lower: false },
    P5: { name: 'Rəhbər məmnuniyyəti', desc: 'Vakansiya bağlananda struktur bölmə rəhbərinin linklə verdiyi orta qiymət (1–5).', lower: false },
    P6: { name: 'Gəlməmə faizi', desc: 'Dövrdəki müsahibələrdən neçə faizinə namizəd gəlməyib. Az olması yaxşıdır.', lower: true },
    P7: { name: 'Məlumatın vaxtında daxil edilməsi', desc: 'Müsahibənin nəticəsi təyin olunmuş gün ərzində sistemə yazılıbmı.', lower: false },
    P8: { name: 'Bağlama faizi', desc: 'Son tarixi bu dövrə düşən və ya bu dövrdə bağlanan vakansiyalardan neçə faizi bağlanıb.', lower: false }
  };
  const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
  const WEEKDAYS = ['B.e.', 'Ç.a.', 'Ç.', 'C.a.', 'C.', 'Ş.', 'B.'];

  /* ======================= VƏZİYYƏT ======================= */
  const S = {
    data: null, ix: {}, perf: null, audit: null,
    f: {
      vac: { q: '', status: 'Aktiv', company: '', rec: '' },
      cand: { q: '', source: '' },
      board: { vac: '' },
      int: { mode: 'list', status: 'all', q: '', week: null },
      perf: { preset: 'month', from: '', to: '', company: '', sel: '' },
      admin: { tab: 'users' }
    }
  };
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const isAdmin = () => S.data && S.data.user.role === 'admin';
  const today = () => (S.data ? S.data.today : new Date().toISOString().slice(0, 10));

  /* ======================= KÖMƏKÇİLƏR ======================= */
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  function toDay(s) {
    if (!s) return '';
    if (isDate(s)) return s;
    const d = new Date(s);
    if (isNaN(d)) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baku', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }
  function fmtD(s) { const d = toDay(s); return d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '—'; }
  function fmtDT(s) {
    if (!s) return '—';
    const d = new Date(s);
    if (isNaN(d)) return esc(s);
    return fmtD(s) + ' ' + new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Baku', hour: '2-digit', minute: '2-digit' }).format(d);
  }
  function days(a, b) {
    a = toDay(a); b = toDay(b);
    if (!a || !b) return null;
    return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
  }
  function addDays(a, n) { const d = new Date(Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) + n * 86400000); return d.toISOString().slice(0, 10); }
  function addMonths(a, n) {
    let y = +a.slice(0, 4), m = +a.slice(5, 7) - 1 + n; const dd = +a.slice(8, 10);
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(Math.min(dd, last)).padStart(2, '0')}`;
  }
  const mins = (t) => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
  const money = (v) => (v === '' || v == null || isNaN(+v)) ? '—' : (+v).toLocaleString('az-AZ').replace(/,/g, ' ') + ' ₼';
  const salaryRange = (v) => (v.salaryMin || v.salaryMax) ? (v.salaryMin && v.salaryMax && v.salaryMin !== v.salaryMax ? `${money(v.salaryMin).replace(' ₼', '')}–${money(v.salaryMax)}` : money(v.salaryMax || v.salaryMin)) : '—';
  const opts = (list, sel, empty) => (empty !== undefined ? `<option value="">${esc(empty)}</option>` : '') + (list || []).map(o => {
    const val = typeof o === 'object' ? o.value : o, lab = typeof o === 'object' ? o.label : o;
    return `<option value="${esc(val)}" ${String(val) === String(sel == null ? '' : sel) ? 'selected' : ''}>${esc(lab)}</option>`;
  }).join('');
  const userName = (id) => (S.ix.user[id] || {}).fullName || '—';
  const candName = (id) => (S.ix.cand[id] || {}).fullName || '—';
  const vacTitle = (id) => (S.ix.vac[id] || {}).title || '—';
  const sortBy = (arr, fn, desc) => arr.slice().sort((a, b) => { const x = fn(a), y = fn(b); return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1); });
  const lines = (s) => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  const scoreCls = (s) => s == null ? 's-na' : s >= 80 ? 's-hi' : s >= 60 ? 's-mid' : 's-lo';
  const scoreTxt = (s) => s == null ? '—' : (Math.round(s * 10) / 10).toString().replace('.', ',');
  const n1 = (x) => x == null ? '—' : (Math.round(x * 10) / 10).toString().replace('.', ',');

  function statusBadge(s) {
    const map = { 'Açıq': 'b-accent', 'Dayandırılıb': 'b-warn', 'Bağlandı': 'b-good', 'Ləğv edildi': '' };
    return `<span class="badge ${map[s] || ''}">${esc(s)}</span>`;
  }
  function stageBadge(s) {
    const cls = s === 'İşə qəbul' ? 'b-good' : s === 'İmtina' ? 'b-bad' : s === 'Təklif' ? 'b-info' : 'b-accent';
    return `<span class="badge ${cls}">${esc(s)}</span>`;
  }
  function attBadge(m) {
    if (m.attendance === 'İştirak edib') return `<span class="badge b-good">Keçirilib</span>`;
    if (m.attendance === 'İştirak etməyib') return `<span class="badge b-bad">Gəlmədi</span>`;
    if (m.date < today()) return `<span class="badge b-warn">Nəticə yazılmayıb</span>`;
    return `<span class="badge b-info">Planlaşdırılıb</span>`;
  }
  function resultBadge(r) {
    if (!r) return '—';
    const cls = r === 'Bəyənildi' ? 'b-good' : r === 'Bəyənilmədi' ? 'b-bad' : 'b-warn';
    return `<span class="badge ${cls}">${esc(r)}</span>`;
  }

  /* ======================= MƏLUMAT ======================= */
  function applyBundle(b) {
    if (!b) return;
    S.data = b;
    const map = (arr) => { const o = {}; arr.forEach(x => { o[x.id] = x; }); return o; };
    S.ix = { user: map(b.users), vac: map(b.vacancies), cand: map(b.candidates), app: map(b.applications), int: map(b.interviews) };
    S.perf = null;
  }
  const appsOfVac = (vid) => S.data.applications.filter(a => a.vacancyId === vid);
  const appsOfCand = (cid) => S.data.applications.filter(a => a.candidateId === cid);
  const intsOfApp = (aid) => sortBy(S.data.interviews.filter(m => m.applicationId === aid), m => m.date + m.startTime);
  const scOfInt = (mid) => S.data.scorecards.filter(s => s.interviewId === mid);
  function intAvg(mid) {
    const vis = scOfInt(mid).filter(s => s.status === 'Təhvil verildi' && s.average !== '');
    if (!vis.length) return null;
    return vis.reduce((a, s) => a + +s.average, 0) / vis.length;
  }
  function appAvg(aid) {
    const vals = intsOfApp(aid).map(m => intAvg(m.id)).filter(x => x != null);
    return vals.length ? vals[vals.length - 1] : null;
  }
  function minScoreOf(v) { const n = parseFloat(v && v.minScore); return isNaN(n) ? +S.data.settings.defaultMinScore || 3 : n; }
  function scoreChip(avg, v) {
    if (avg == null) return '';
    const low = avg < minScoreOf(v);
    return `<span class="badge ${low ? 'b-bad' : 'b-good'}" title="${low ? 'Minimum həddən aşağı' : 'Orta qiymət'}">★ ${n1(avg)}</span>`;
  }
  const canEdit = (v) => v && (isAdmin() || v.recruiterId === S.data.user.id);

  async function act(action, data, okMsg) {
    try {
      const res = await call(action, data);
      if (res && res.bundle) applyBundle(res.bundle);
      else if (res && res.vacancies) applyBundle(res);
      if (okMsg) toast(okMsg);
      render();
      return res;
    } catch (e) {
      if (e.auth) { logout(true); }
      throw e;
    }
  }

  /* ======================= MODAL ======================= */
  function formData(form) {
    const o = {};
    $$('input, select, textarea', form).forEach(el => {
      if (!el.name || el.disabled) return;
      if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; return; }
      if (el.type === 'checkbox') { o[el.name] = el.checked; return; }
      o[el.name] = el.value.trim();
    });
    return o;
  }
  function modal({ title, body, size, foot, submitText, onSubmit, locked, onOpen }) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    const footer = foot === false ? '' : `<div class="modal-foot">${foot || ((locked ? '' : '<button type="button" class="btn" data-close>İmtina</button>') + (onSubmit ? `<button type="submit" class="btn btn-primary">${esc(submitText || 'Yadda saxla')}</button>` : ''))}</div>`;
    back.innerHTML = `<form class="modal ${size || ''}" novalidate autocomplete="off">
      <div class="modal-head"><h2>${title}</h2>${locked ? '' : '<button type="button" class="x" data-close aria-label="Bağla">×</button>'}</div>
      <div class="modal-body"><div class="err-slot"></div>${body}</div>${footer}</form>`;
    document.body.appendChild(back);
    const form = back.querySelector('form');
    const close = () => back.remove();
    back.addEventListener('mousedown', (e) => { back._downOnBack = e.target === back; });
    back.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { e.preventDefault(); close(); }
      else if (e.target === back && back._downOnBack && !locked) close();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!onSubmit) return close();
      const btn = form.querySelector('[type=submit]');
      if (btn) btn.disabled = true;
      $('.err-slot', form).innerHTML = '';
      try {
        const r = await onSubmit(formData(form), form, close);
        if (r !== false) close();
      } catch (err) {
        $('.err-slot', form).innerHTML = `<div class="err-box" style="margin-bottom:12px">${esc(err.message)}</div>`;
        form.querySelector('.modal-body').scrollTop = 0;
        back.scrollTop = 0;
      } finally { if (btn) btn.disabled = false; }
    });
    wireConditional(form);
    if (onOpen) onOpen(form, close);
    const first = form.querySelector('input:not([type=hidden]):not([type=radio]), select, textarea');
    if (first && !first.value) first.focus();
    return { el: back, form, close };
  }
  // data-show="ad=dəyər1|dəyər2" və ya data-hide="ad=dəyər"
  function wireConditional(form) {
    const update = () => {
      const fd = formData(form);
      $$('[data-show],[data-hide]', form).forEach(el => {
        const spec = el.dataset.show || el.dataset.hide;
        const [name, vals] = spec.split('=');
        const match = vals.split('|').includes(fd[name] || '');
        const visible = el.dataset.show ? match : !match;
        el.classList.toggle('hidden', !visible);
        $$('input,select,textarea', el).forEach(i => { i.disabled = !visible; });
      });
    };
    form.addEventListener('change', update);
    form._updateCond = update;
    update();
  }
  function confirmBox(title, text, okText, danger) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal({
        title: esc(title), body: `<p style="margin:0">${text}</p>`, submitText: okText || 'Təsdiq et',
        onSubmit: () => { done = true; resolve(true); }
      });
      if (danger) m.form.querySelector('[type=submit]').classList.add('btn-danger');
      const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(false); } });
      obs.observe(document.body, { childList: true });
    });
  }
  const field = (label, inner, opt = {}) => `<label class="f ${opt.full ? 'full' : ''} ${opt.cls || ''}" ${opt.attr || ''}><span>${esc(label)}${opt.req ? ' <span class="req">*</span>' : ''}</span>${inner}</label>`;

  /* ======================= GİRİŞ ======================= */
  function brand(dark) {
    return `<div class="brand"><div class="brand-mark">İQ</div><div class="brand-name">İşə qəbul<small>${dark ? 'Recruitment platforması' : 'Recruitment platforması'}</small></div></div>`;
  }
  function renderLogin(msg) {
    document.title = 'Giriş — İşə qəbul platforması';
    $('#root').innerHTML = `<div class="login-wrap"><form class="card login-card" id="loginForm" autocomplete="on">
      ${brand()}
      <h2 style="margin-bottom:4px">Sistemə giriş</h2>
      <p class="muted small" style="margin:0 0 16px">İstifadəçi adı və parolunuzu daxil edin.</p>
      ${msg ? `<div class="err-box" style="margin-bottom:12px">${esc(msg)}</div>` : ''}
      <div class="grid" style="gap:12px">
        ${field('İstifadəçi adı', '<input name="username" autocomplete="username" required autocapitalize="none">')}
        ${field('Parol', '<input name="password" type="password" autocomplete="current-password" required>')}
        <button class="btn btn-primary" type="submit" style="justify-content:center;padding:10px">Daxil ol</button>
      </div>
      <p class="muted small" style="margin:14px 0 0">Parolu unutmusunuzsa, admin ilə əlaqə saxlayın.</p>
    </form></div>`;
    const f = $('#loginForm');
    f.username.focus();
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = f.querySelector('button'); btn.disabled = true;
      try {
        const d = await call('login', { username: f.username.value, password: f.password.value });
        store.set('rp_token', d.token);
        await boot();
      } catch (err) { renderLogin(err.message); }
      finally { btn.disabled = false; }
    });
  }
  async function logout(expired) {
    try { if (!expired) await call('logout', {}); } catch (e) { /* */ }
    store.del('rp_token');
    S.data = null;
    renderLogin(expired ? 'Sessiya bitib, yenidən daxil olun.' : '');
  }
  function passwordModal(forced) {
    modal({
      title: forced ? 'Yeni parol təyin edin' : 'Parolu dəyiş', locked: forced,
      body: `${forced ? '<div class="info-box" style="margin-bottom:12px">Təhlükəsizlik üçün müvəqqəti parolu dəyişməlisiniz.</div>' : ''}
        <div class="grid" style="gap:12px">
        ${field('Cari parol', '<input type="password" name="oldPassword" autocomplete="current-password">', { req: 1 })}
        ${field('Yeni parol', '<input type="password" name="newPassword" autocomplete="new-password">', { req: 1 })}
        ${field('Yeni parolun təkrarı', '<input type="password" name="newPassword2" autocomplete="new-password">', { req: 1 })}
        <div class="muted small">Ən azı 8 simvol; həm hərf, həm rəqəm olmalıdır.</div></div>`,
      submitText: 'Parolu dəyiş',
      onSubmit: async (d) => {
        if (d.newPassword !== d.newPassword2) throw new Error('Yeni parollar eyni deyil.');
        await act('changePassword', d, 'Parol dəyişdirildi.');
      }
    });
  }

  /* ======================= QABIQ VƏ MARŞRUT ======================= */
  const ICONS = {
    panel: '<path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>',
    vac: '<path d="M10 2h4a2 2 0 0 1 2 2v2h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4V4a2 2 0 0 1 2-2zm4 4V4h-4v2h4z"/>',
    cand: '<path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h7v-2.5c0-.9.4-1.8 1.1-2.5A10 10 0 0 0 8 13zm8 0c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z"/>',
    board: '<path d="M3 3h5v18H3zM10 3h5v12h-5zM17 3h4v8h-4z"/>',
    int: '<path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11zM7 11h5v5H7z"/>',
    perf: '<path d="M4 20h16v2H4zM6 10h3v8H6zm5-6h3v14h-3zm5 9h3v5h-3z"/>',
    admin: '<path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7 7 0 0 0-1.7-1L15 3h-4l-.4 2.9a7 7 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7 7 0 0 0 1.7 1L11 21h4l.4-2.9a7 7 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 3.5-3.5 3.5 3.5 0 0 1-3.5 3.5z"/>'
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" fill="currentColor">${ICONS[k]}</svg>`;
  function routeParts() { return (location.hash.replace(/^#\/?/, '') || 'panel').split('/'); }
  function shell() {
    const u = S.data.user;
    const nav = [['panel', 'Panel', 'panel'], ['vacancies', 'Vakansiyalar', 'vac'], ['candidates', 'Namizədlər', 'cand'], ['board', 'Mərhələ lövhəsi', 'board'], ['interviews', 'Müsahibələr', 'int'], ['performance', 'Performans', 'perf']];
    if (isAdmin()) nav.push(['admin', 'Admin', 'admin']);
    $('#root').innerHTML = `<div class="app">
      <aside class="sidebar">${brand(true)}
        <nav class="nav">${nav.map(([r, l, i]) => `<a href="#/${r}" data-route="${r}">${icon(i)}<span>${l}</span></a>`).join('')}</nav>
        <div class="sidebar-foot"><div class="who">${esc(u.fullName)}</div><div class="role">${u.role === 'admin' ? 'Administrator' : 'Recruiter'}</div>
          <div class="links"><a href="#" data-act="pw">Parolu dəyiş</a><a href="#" data-act="logout">Çıxış</a></div></div>
      </aside>
      <main class="main" id="main"></main></div>`;
  }
  function render() {
    if (!S.data) return;
    if (!$('#main')) shell();
    const [r, id] = routeParts();
    const routeKey = r === 'vacancy' ? 'vacancies' : r;
    $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === routeKey));
    const views = { panel: viewPanel, vacancies: viewVacancies, vacancy: () => viewVacancy(id), candidates: viewCandidates, board: viewBoard, interviews: viewInterviews, performance: viewPerformance, admin: viewAdmin };
    const fn = views[r] || viewPanel;
    if (r === 'admin' && !isAdmin()) { location.hash = '#/panel'; return; }
    const keep = window.scrollY;
    $('#main').innerHTML = fn();
    window.scrollTo(0, keep);
    const titles = { panel: 'Panel', vacancies: 'Vakansiyalar', vacancy: 'Vakansiya', candidates: 'Namizədlər', board: 'Mərhələ lövhəsi', interviews: 'Müsahibələr', performance: 'Performans', admin: 'Admin' };
    document.title = (titles[r] || 'Panel') + ' — İşə qəbul platforması';
    if (r === 'board') wireBoard();
    if (r === 'performance') loadPerformance();
    if (r === 'admin' && S.f.admin.tab === 'audit' && !S.audit) loadAudit();
    if (r === 'admin' && S.f.admin.tab === 'params') wireWeights();
  }
  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });

  /* ======================= PANEL ======================= */
  function viewPanel() {
    const d = S.data, t = today(), month = t.slice(0, 7);
    const active = d.vacancies.filter(v => v.status === 'Açıq' || v.status === 'Dayandırılıb');
    const intsMonth = d.interviews.filter(m => m.date.slice(0, 7) === month);
    const hiresMonth = d.applications.filter(a => a.stage === 'İşə qəbul' && (a.hireDate || '').slice(0, 7) === month);
    const pendSc = d.scorecards.filter(s => s.status === 'Gözlənilir');
    const pendSat = d.satisfaction.filter(s => s.status === 'Gözlənilir');
    const upcoming = sortBy(d.interviews.filter(m => (m.date === t || m.date === addDays(t, 1)) && !m.attendance), m => m.date + m.startTime);
    const missing = sortBy(d.interviews.filter(m => m.date < t && !m.attendance), m => m.date);
    const probation = sortBy(d.applications.filter(a => a.stage === 'İşə qəbul' && isDate(a.probationEnd) && a.probationEnd <= addDays(t, 14) && !a.probationResult), a => a.probationEnd);
    const overdue = active.filter(v => v.status === 'Açıq' && isDate(v.deadline) && v.deadline < t);
    const offers = d.applications.filter(a => a.stage === 'Təklif' && (!a.offerResponse || a.offerResponse === 'Gözlənilir'));
    const li = (inner, actn, id) => `<li class="click" data-act="${actn}" data-id="${esc(id)}" style="cursor:pointer">${inner}</li>`;
    const block = (title, items, empty) => `<div class="card"><div class="card-head"><h3>${title}</h3><span class="badge">${items.length}</span></div>
      ${items.length ? `<ul class="list-plain">${items.slice(0, 8).join('')}</ul>` : `<div class="empty small">${empty}</div>`}</div>`;
    return `<div class="page-head"><div><h1>Salam, ${esc(d.user.fullName.split(' ')[1] || d.user.fullName)}</h1><div class="sub">${fmtD(t)} · ${isAdmin() ? 'Bütün komandanın vəziyyəti' : 'Sizin işləriniz'}</div></div>
      <div class="actions"><button class="btn" data-act="newCandidate">+ Namizəd</button><button class="btn" data-act="newInterview">+ Müsahibə</button><button class="btn btn-primary" data-act="newVacancy">+ Vakansiya</button></div></div>
      <div class="grid grid-4" style="margin-bottom:16px">
        <a class="card tile" href="#/vacancies"><div class="label">Aktiv vakansiya</div><div class="value">${active.length}</div><div class="hint">${overdue.length ? `<span style="color:var(--bad)">${overdue.length} vakansiyanın son tarixi keçib</span>` : 'Son tarixi keçən yoxdur'}</div></a>
        <a class="card tile" href="#/interviews"><div class="label">Bu ay müsahibə</div><div class="value">${intsMonth.length}</div><div class="hint">${intsMonth.filter(m => m.attendance === 'İştirak etməyib').length} namizəd gəlməyib</div></a>
        <div class="card tile"><div class="label">Bu ay işə qəbul</div><div class="value">${hiresMonth.length}</div><div class="hint">${offers.length} təklif cavab gözləyir</div></div>
        <div class="card tile"><div class="label">Gözləyən linklər</div><div class="value">${pendSc.length + pendSat.length}</div><div class="hint">Rəhbərlərdən qiymətləndirmə</div></div>
      </div>
      <div class="grid grid-2">
        ${block('Bu gün və sabah müsahibələr', upcoming.map(m => li(`<div><b>${esc(candName(m.candidateId))}</b><div class="muted small">${esc(vacTitle(m.vacancyId))}</div></div><span class="nowrap small">${m.date === t ? 'Bu gün' : 'Sabah'} · ${esc(m.startTime)}</span>`, 'openInterview', m.id)), 'Planlaşdırılmış müsahibə yoxdur.')}
        ${block('Nəticəsi yazılmayan müsahibələr', missing.map(m => li(`<div><b>${esc(candName(m.candidateId))}</b><div class="muted small">${esc(vacTitle(m.vacancyId))}</div></div><span class="badge b-warn">${fmtD(m.date)}</span>`, 'openInterview', m.id)), 'Hamısı vaxtında daxil edilib. 👍')}
        ${block('Təklif cavabı gözlənilir', offers.map(a => li(`<div><b>${esc(candName(a.candidateId))}</b><div class="muted small">${esc(vacTitle(a.vacancyId))}</div></div><span class="small nowrap">${fmtD(a.offerDate)} · ${days(a.offerDate, t)} gün</span>`, 'openApp', a.id)), 'Cavab gözləyən təklif yoxdur.')}
        ${block('Sınaq müddəti bitənlər', probation.map(a => li(`<div><b>${esc(candName(a.candidateId))}</b><div class="muted small">${esc(vacTitle(a.vacancyId))}</div></div><span class="badge ${a.probationEnd <= t ? 'b-warn' : ''}">${fmtD(a.probationEnd)}</span>`, 'openApp', a.id)), 'Yaxın 14 gündə bitən sınaq müddəti yoxdur.')}
        ${block('Son tarixi keçən vakansiyalar', overdue.map(v => `<li class="click" style="cursor:pointer" onclick="location.hash='#/vacancy/${esc(v.id)}'"><div><b>${esc(v.title)}</b><div class="muted small">${esc(v.company)}${isAdmin() ? ' · ' + esc(userName(v.recruiterId)) : ''}</div></div><span class="badge b-bad">${fmtD(v.deadline)}</span></li>`), 'Yoxdur.')}
        ${block('Gözləyən qiymətləndirmə linkləri', pendSc.map(s => { const m = S.ix.int[s.interviewId] || {}; return li(`<div><b>${esc(s.evaluatorName)}</b><div class="muted small">${esc(candName(m.candidateId))} · ${esc(vacTitle(m.vacancyId))}</div></div><span class="small">${fmtD(s.createdAt)}</span>`, 'openInterview', m.id); }).concat(pendSat.map(s => `<li class="click" style="cursor:pointer" onclick="location.hash='#/vacancy/${esc(s.vacancyId)}'"><div><b>${esc(s.managerName)}</b><div class="muted small">Məmnuniyyət sorğusu · ${esc(vacTitle(s.vacancyId))}</div></div><span class="small">${fmtD(s.createdAt)}</span></li>`)), 'Yoxdur.')}
      </div>`;
  }

  /* ======================= VAKANSİYALAR ======================= */
  function filteredVacancies() {
    const f = S.f.vac, q = f.q.toLowerCase();
    return sortBy(S.data.vacancies.filter(v => {
      if (f.status === 'Aktiv' && !(v.status === 'Açıq' || v.status === 'Dayandırılıb')) return false;
      if (f.status !== 'Aktiv' && f.status !== 'Hamısı' && v.status !== f.status) return false;
      if (f.company && v.company !== f.company) return false;
      if (f.rec && v.recruiterId !== f.rec) return false;
      if (q && !(`${v.id} ${v.title} ${v.company} ${v.department} ${v.hiringManager}`.toLowerCase().includes(q))) return false;
      return true;
    }), v => v.openedAt, true);
  }
  function viewVacancies() {
    const f = S.f.vac, s = S.data.settings, t = today();
    const list = filteredVacancies();
    const recs = S.data.users.filter(u => u.active);
    return `<div class="page-head"><div><h1>Vakansiyalar</h1><div class="sub">${list.length} vakansiya</div></div>
      <div class="actions"><button class="btn" data-act="exportVacancies">Excel-ə ixrac</button><button class="btn btn-primary" data-act="newVacancy">+ Yeni vakansiya</button></div></div>
      <div class="card"><div class="filters">
        <input type="search" placeholder="Axtar: ad, şirkət, rəhbər…" value="${esc(f.q)}" data-filter="vac.q">
        <select data-filter="vac.status">${opts(['Aktiv', 'Hamısı'].concat(V_STATUSES), f.status)}</select>
        <select data-filter="vac.company">${opts(s.companies, f.company, 'Bütün şirkətlər')}</select>
        ${isAdmin() ? `<select data-filter="vac.rec">${opts(recs.map(u => ({ value: u.id, label: u.fullName })), f.rec, 'Bütün recruiterlər')}</select>` : ''}
      </div>
      ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Vakansiya</th><th>Şirkət / bölmə</th>${isAdmin() ? '<th>Recruiter</th>' : ''}<th class="right">Namizəd</th><th class="right">Qəbul / plan</th><th>Açılıb</th><th>Son tarix</th><th class="right">Gün</th><th>Status</th></tr></thead><tbody>
      ${list.map(v => {
        const apps = appsOfVac(v.id);
        const hired = apps.filter(a => a.stage === 'İşə qəbul').length;
        const activeApps = apps.filter(a => !CLOSED.includes(a.stage)).length;
        const end = v.closedAt || t;
        const openDays = Math.max(0, (days(v.openedAt, end) || 0) - (+v.pausedDays || 0));
        const late = v.status === 'Açıq' && isDate(v.deadline) && v.deadline < t;
        return `<tr class="click" onclick="location.hash='#/vacancy/${esc(v.id)}'">
          <td class="muted nowrap">${esc(v.id)}</td><td><b>${esc(v.title)}</b>${v.priority === 'Təcili' || v.priority === 'Yüksək' ? ` <span class="badge ${v.priority === 'Təcili' ? 'b-bad' : 'b-warn'}">${esc(v.priority)}</span>` : ''}</td>
          <td>${esc(v.company)}<div class="muted small">${esc(v.department)}</div></td>${isAdmin() ? `<td class="small">${esc(userName(v.recruiterId))}</td>` : ''}
          <td class="right num">${activeApps}<span class="muted"> / ${apps.length}</span></td><td class="right num">${hired} / ${esc(v.headcount)}</td>
          <td class="nowrap">${fmtD(v.openedAt)}</td><td class="nowrap" ${late ? 'style="color:var(--bad);font-weight:600"' : ''}>${fmtD(v.deadline)}</td><td class="right num">${openDays}</td><td>${statusBadge(v.status)}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<div class="empty">Vakansiya tapılmadı.</div>'}</div>`;
  }

  function viewVacancy(id) {
    const v = S.ix.vac[id];
    if (!v) return `<div class="card empty">Vakansiya tapılmadı və ya baxmağa icazəniz yoxdur. <a href="#/vacancies">Siyahıya qayıt</a></div>`;
    const t = today();
    const apps = sortBy(appsOfVac(v.id), a => STAGES.indexOf(a.stage));
    const ints = sortBy(S.data.interviews.filter(m => m.vacancyId === v.id), m => m.date + m.startTime, true);
    const hired = apps.filter(a => a.stage === 'İşə qəbul').length;
    const sat = S.data.satisfaction.filter(x => x.vacancyId === v.id);
    const openDays = Math.max(0, (days(v.openedAt, v.closedAt || t) || 0) - (+v.pausedDays || 0));
    const target = (S.data.settings.targetDays || {})[v.difficulty] || 30;
    const edit = canEdit(v);
    const statusBtns = !edit ? '' : {
      'Açıq': `<button class="btn" data-act="vacStatus" data-id="${v.id}" data-status="Dayandırılıb">Dayandır</button><button class="btn" data-act="vacStatus" data-id="${v.id}" data-status="Bağlandı">Bağla</button><button class="btn btn-danger" data-act="vacStatus" data-id="${v.id}" data-status="Ləğv edildi">Ləğv et</button>`,
      'Dayandırılıb': `<button class="btn" data-act="vacStatus" data-id="${v.id}" data-status="Açıq">Davam etdir</button><button class="btn btn-danger" data-act="vacStatus" data-id="${v.id}" data-status="Ləğv edildi">Ləğv et</button>`,
      'Bağlandı': `<button class="btn" data-act="vacStatus" data-id="${v.id}" data-status="Açıq">Yenidən aç</button>`,
      'Ləğv edildi': `<button class="btn" data-act="vacStatus" data-id="${v.id}" data-status="Açıq">Yenidən aç</button>`
    }[v.status];
    const counts = STAGES.map(st => ({ st, n: apps.filter(a => a.stage === st).length }));
    return `<div class="page-head"><div><div class="muted small"><a href="#/vacancies">Vakansiyalar</a> / ${esc(v.id)}</div>
        <h1 style="margin-top:4px">${esc(v.title)} ${statusBadge(v.status)}</h1><div class="sub">${esc(v.company)}${v.department ? ' · ' + esc(v.department) : ''}</div></div>
      <div class="actions">${edit ? `<button class="btn" data-act="editVacancy" data-id="${v.id}">Redaktə et</button>` : ''}${statusBtns}
        ${edit && v.status === 'Açıq' ? `<button class="btn btn-primary" data-act="addToVacancy" data-id="${v.id}">+ Namizəd əlavə et</button>` : ''}</div></div>
      <div class="grid grid-3" style="margin-bottom:16px">
        <div class="card card-pad"><h3 style="margin-bottom:10px">Məlumat</h3><dl class="kv">
          <dt>Recruiter</dt><dd>${esc(userName(v.recruiterId))}</dd>
          <dt>Vakansiyanı verən</dt><dd>${esc(v.hiringManager || '—')}</dd>
          <dt>Ə/H aralığı</dt><dd>${salaryRange(v)}</dd>
          <dt>Çətinlik / prioritet</dt><dd>${esc(v.difficulty)} · ${esc(v.priority)}</dd>
          <dt>Minimum bal</dt><dd>${n1(minScoreOf(v))} / 5</dd>
          ${v.note ? `<dt>Qeyd</dt><dd>${esc(v.note)}</dd>` : ''}</dl></div>
        <div class="card card-pad"><h3 style="margin-bottom:10px">Müddət</h3><dl class="kv">
          <dt>Açılıb</dt><dd>${fmtD(v.openedAt)}</dd><dt>Son tarix</dt><dd>${fmtD(v.deadline)}</dd>
          ${v.closedAt ? `<dt>${v.status === 'Ləğv edildi' ? 'Ləğv edilib' : 'Bağlanıb'}</dt><dd>${fmtD(v.closedAt)}</dd>` : ''}
          <dt>Açıq qaldığı gün</dt><dd>${openDays} gün <span class="muted">(hədəf ${target})</span></dd>
          ${+v.pausedDays || v.pausedSince ? `<dt>Dayandırılıb</dt><dd>${esc(v.pausedDays || 0)} gün${v.pausedSince ? ` (${fmtD(v.pausedSince)}-dən bəri)` : ''}</dd>` : ''}
          <dt>İşə qəbul / plan</dt><dd>${hired} / ${esc(v.headcount)}</dd></dl></div>
        <div class="card card-pad"><h3 style="margin-bottom:10px">Rəhbər məmnuniyyəti</h3>
          ${sat.length ? sat.map(x => x.status === 'Təhvil verildi'
            ? `<div style="margin-bottom:8px"><span class="score ${x.score >= 4 ? 's-hi' : x.score >= 3 ? 's-mid' : 's-lo'}">${esc(x.score)} / 5</span> <b>${esc(x.managerName)}</b><div class="muted small">${fmtD(x.submittedAt)}${x.comment ? ' · ' + esc(x.comment) : ''}</div></div>`
            : `<div style="margin-bottom:8px"><span class="badge b-warn">Gözlənilir</span> <b>${esc(x.managerName)}</b> <button type="button" class="btn-link small" data-act="showLink" data-token="${esc(x.linkToken)}" data-who="${esc(x.managerName)}" data-kind="sat">Linki göstər</button> · <button type="button" class="btn-link small" data-act="cancelLink" data-id="${esc(x.id)}" data-kind="sat">Ləğv et</button></div>`).join('')
            : `<p class="muted small" style="margin-top:0">Vakansiya bağlananda rəhbərə 1 sualdan ibarət link göndərilir.</p>`}
          ${edit && v.status === 'Bağlandı' && !sat.some(x => x.status === 'Gözlənilir') && !sat.some(x => x.status === 'Təhvil verildi') ? `<button class="btn btn-sm" data-act="satLink" data-id="${v.id}">Məmnuniyyət linki yarat</button>` : ''}
        </div></div>
      <div class="card" style="margin-bottom:16px"><div class="card-head"><h3>Namizədlər</h3><div class="actions small">${counts.filter(c => c.n).map(c => `<span class="badge">${esc(c.st)}: ${c.n}</span>`).join('')}<a class="btn btn-sm" href="#/board" data-act="boardFor" data-id="${v.id}">Lövhədə aç</a></div></div>
        ${apps.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Namizəd</th><th>Mərhələ</th><th class="right">Mərhələdə</th><th>Son müsahibə</th><th>Qiymət</th><th>Mənbə</th></tr></thead><tbody>
        ${apps.map(a => { const c = S.ix.cand[a.candidateId] || {}; const last = intsOfApp(a.id).slice(-1)[0]; return `<tr class="click" data-act="openApp" data-id="${a.id}"><td><b>${esc(c.fullName)}</b><div class="muted small">${esc(c.phone || '')}</div></td><td>${stageBadge(a.stage)}</td><td class="right num">${days(a.stageChangedAt, t)} gün</td><td>${last ? fmtD(last.date) + ' ' + attBadge(last) : '—'}</td><td>${scoreChip(appAvg(a.id), v) || '—'}</td><td class="small">${esc(c.source || '—')}</td></tr>`; }).join('')}
        </tbody></table></div>` : '<div class="empty">Hələ namizəd əlavə olunmayıb.</div>'}</div>
      <div class="card"><div class="card-head"><h3>Müsahibələr</h3></div>
        ${ints.length ? interviewTable(ints, false) : '<div class="empty">Müsahibə yoxdur.</div>'}</div>`;
  }

  function vacancyForm(v) {
    v = v || {};
    const s = S.data.settings;
    const recs = S.data.users.filter(u => u.active);
    modal({
      title: v.id ? 'Vakansiyanı redaktə et' : 'Yeni vakansiya',
      size: 'lg',
      body: `<div class="form-grid">
        ${field('Vakansiyanın adı', `<input name="title" value="${esc(v.title)}" placeholder="məs. Call-operatoru">`, { req: 1, full: 1 })}
        ${field('Şirkət', `<select name="company">${opts(s.companies, v.company, 'Seçin…')}</select>`, { req: 1 })}
        ${field('Struktur bölmə', `<select name="department">${opts(s.departments, v.department, 'Seçin…')}</select>`)}
        ${field('Vakansiyanı verən şəxs (rəhbər)', `<input name="hiringManager" value="${esc(v.hiringManager)}" placeholder="Ad, soyad">`)}
        ${isAdmin() ? field('Məsul recruiter', `<select name="recruiterId">${opts(recs.map(u => ({ value: u.id, label: u.fullName })), v.recruiterId || S.data.user.id)}</select>`) : `<input type="hidden" name="recruiterId" value="${esc(v.recruiterId || S.data.user.id)}">`}
        ${field('Lazım olan say', `<input name="headcount" type="number" min="1" value="${esc(v.headcount || 1)}">`)}
        <div class="form-section">Əmək haqqı (AZN, net)</div>
        ${field('Minimum', `<input name="salaryMin" type="number" min="0" step="10" value="${esc(v.salaryMin)}">`)}
        ${field('Maksimum', `<input name="salaryMax" type="number" min="0" step="10" value="${esc(v.salaryMax)}">`)}
        <div class="form-section">Müddət və prioritet</div>
        ${field('Açılma tarixi', `<input name="openedAt" type="date" value="${esc(v.openedAt || today())}">`, { req: 1 })}
        ${field('Bağlanması üçün son tarix', `<input name="deadline" type="date" value="${esc(v.deadline)}">`)}
        ${field('Çətinlik dərəcəsi', `<select name="difficulty">${opts(DIFFICULTY.map(x => ({ value: x, label: `${x} (hədəf ${(s.targetDays || {})[x] || '—'} gün)` })), v.difficulty || 'Orta')}</select>`)}
        ${field('Prioritet', `<select name="priority">${opts(PRIORITY, v.priority || 'Normal')}</select>`)}
        ${field('Minimum qiymət (1–5)', `<input name="minScore" type="number" min="1" max="5" step="0.1" value="${esc(v.minScore)}" placeholder="standart: ${esc(s.defaultMinScore)}">`)}
        ${field('Qeyd', `<textarea name="note" rows="2">${esc(v.note)}</textarea>`, { full: 1 })}
      </div>`,
      onSubmit: async (d) => {
        d.id = v.id;
        const res = await act('saveVacancy', d, v.id ? 'Vakansiya yeniləndi.' : 'Vakansiya yaradıldı.');
        if (!v.id) location.hash = '#/vacancy/' + res.id;
      }
    });
  }

  async function changeVacancyStatus(id, status) {
    const v = S.ix.vac[id];
    const texts = {
      'Dayandırılıb': 'Vakansiya dayandırılacaq. Dayandırılmış günlər recruiterin bağlanma müddətinə daxil edilmir.',
      'Bağlandı': 'Vakansiya bağlanacaq. Bundan sonra rəhbərə məmnuniyyət linki göndərə biləcəksiniz.',
      'Ləğv edildi': 'Vakansiya ləğv ediləcək və performans hesablamasına daxil edilməyəcək.',
      'Açıq': 'Vakansiya yenidən aktiv olacaq.'
    };
    if (status === 'Bağlandı') {
      const hired = appsOfVac(id).filter(a => a.stage === 'İşə qəbul').length;
      if (!hired) texts['Bağlandı'] = '<b>Diqqət:</b> bu vakansiyada işə qəbul edilmiş namizəd yoxdur. Vakansiya doldurulmayıbsa, "Ləğv et" seçimi daha düzgündür.<br><br>' + texts['Bağlandı'];
    }
    if (!(await confirmBox(`${v.title}: ${status}`, texts[status], 'Təsdiq et', status === 'Ləğv edildi'))) return;
    await act('setVacancyStatus', { id, status }, 'Status dəyişdi: ' + status).catch(e => toast(e.message, true));
    if (status === 'Bağlandı') satLinkFlow(id);
  }
  async function satLinkFlow(vid) {
    const v = S.ix.vac[vid];
    modal({
      title: 'Rəhbər məmnuniyyəti sorğusu',
      body: `<p style="margin-top:0">Vakansiyanı verən rəhbərə 1 sualdan ibarət link göndərin: <i>"Recruiterin bu vakansiya üzrə işindən nə dərəcədə razısınız?"</i> Cavab performansdakı <b>P5</b> göstəricisinə düşür.</p>
        ${field('Rəhbərin adı', `<input name="managerName" value="${esc(v.hiringManager)}">`, { req: 1 })}`,
      submitText: 'Link yarat',
      onSubmit: async (d) => {
        const res = await act('createSatisfactionLink', { vacancyId: vid, managerName: d.managerName });
        showLink(res.token, d.managerName, 'sat');
      }
    });
  }

  /* ======================= NAMİZƏDLƏR ======================= */
  function viewCandidates() {
    const f = S.f.cand, q = f.q.toLowerCase(), s = S.data.settings;
    const qd = q.replace(/\D/g, '');
    const list = sortBy(S.data.candidates.filter(c => {
      if (f.source && c.source !== f.source) return false;
      if (q && !(`${c.id} ${c.fullName} ${c.email}`.toLowerCase().includes(q) || (qd.length >= 3 && String(c.phone).replace(/\D/g, '').includes(qd)))) return false;
      return true;
    }), c => c.createdAt, true);
    return `<div class="page-head"><div><h1>Namizədlər bazası</h1><div class="sub">${list.length} namizəd · baza bütün komanda üçün ortaqdır</div></div>
      <div class="actions"><button class="btn" data-act="exportCandidates">Excel-ə ixrac</button><button class="btn btn-primary" data-act="newCandidate">+ Yeni namizəd</button></div></div>
      <div class="card"><div class="filters">
        <input type="search" placeholder="Axtar: ad, telefon, email…" value="${esc(f.q)}" data-filter="cand.q" style="min-width:260px">
        <select data-filter="cand.source">${opts(s.sources, f.source, 'Bütün mənbələr')}</select></div>
      ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Ad, soyad</th><th>Əlaqə</th><th>Mənbə</th><th class="right">Ə/H gözləntisi</th><th>Vakansiyalar</th><th>Əlavə olunub</th></tr></thead><tbody>
      ${list.slice(0, 500).map(c => {
        const apps = appsOfCand(c.id);
        return `<tr class="click" data-act="openCandidate" data-id="${c.id}"><td class="muted">${esc(c.id)}</td><td><b>${esc(c.fullName)}</b>${c.cvUrl ? ' <span class="badge">CV</span>' : ''}</td>
          <td class="small">${esc(c.phone || '')}<div class="muted">${esc(c.email || '')}</div></td><td class="small">${esc(c.source || '—')}</td><td class="right num">${money(c.salaryExpectation)}</td>
          <td>${apps.map(a => `<div class="small">${esc(vacTitle(a.vacancyId))} ${stageBadge(a.stage)}</div>`).join('') || '<span class="muted small">—</span>'}</td><td class="small nowrap">${fmtD(c.createdAt)}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<div class="empty">Namizəd tapılmadı.</div>'}</div>`;
  }

  function findDuplicates(d, selfId) {
    const p = String(d.phone || '').replace(/\D/g, '').slice(-9);
    const e = String(d.email || '').trim().toLowerCase();
    const n = String(d.fullName || '').trim().toLowerCase();
    return S.data.candidates.filter(c => c.id !== selfId && (
      (p.length >= 7 && String(c.phone).replace(/\D/g, '').slice(-9) === p) ||
      (e && c.email.toLowerCase() === e) ||
      (n.length > 5 && c.fullName.trim().toLowerCase() === n)));
  }
  function candidateForm(c, opt) {
    c = c || {}; opt = opt || {};
    const s = S.data.settings;
    const myOpen = S.data.vacancies.filter(v => v.status === 'Açıq' && canEdit(v));
    let force = false;
    modal({
      title: c.id ? 'Namizədi redaktə et' : 'Yeni namizəd',
      size: 'lg',
      body: `<div class="form-grid">
        ${field('Soyad, ad, ata adı', `<input name="fullName" value="${esc(c.fullName)}">`, { req: 1, full: 1 })}
        ${field('Telefon', `<input name="phone" value="${esc(c.phone)}" placeholder="+994 50 000 00 00">`)}
        ${field('Email', `<input name="email" type="email" value="${esc(c.email)}">`)}
        <div class="full" id="dupSlot"></div>
        ${field('CV linki (Google Drive və s.)', `<input name="cvUrl" value="${esc(c.cvUrl)}" placeholder="https://…">`, { full: 1 })}
        ${field('Tapılma mənbəyi', `<select name="source">${opts(s.sources, c.source, 'Seçin…')}</select>`)}
        ${field('Tövsiyə edən / digər', `<input name="sourceNote" value="${esc(c.sourceNote)}">`, { attr: 'data-show="source=Tövsiyə|Digər|Daxili müraciət"' })}
        ${field('Ə/H gözləntisi (AZN)', `<input name="salaryExpectation" type="number" min="0" step="10" value="${esc(c.salaryExpectation)}">`)}
        ${field('Qeyd', `<textarea name="note" rows="2">${esc(c.note)}</textarea>`, { full: 1 })}
        ${!c.id && myOpen.length ? `<div class="form-section">Vakansiyaya əlavə et (istəyə bağlı)</div>
          ${field('Vakansiya', `<select name="vacancyId">${opts(myOpen.map(v => ({ value: v.id, label: `${v.title} — ${v.company}` })), opt.vacancyId || '', 'Hələ əlavə etmə')}</select>`, { full: 1 })}` : ''}
      </div>`,
      onOpen: (form) => {
        const check = () => {
          const dups = findDuplicates(formData(form), c.id);
          $('#dupSlot', form).innerHTML = dups.length ? `<div class="hint-box"><b>Bazada oxşar namizəd var:</b> ${dups.map(x => `<a href="#" data-act="useCandidate" data-id="${x.id}" data-vac="${esc(opt.vacancyId || '')}">${esc(x.fullName)} (${esc(x.id)}${x.phone ? ', ' + esc(x.phone) : ''})</a>`).join(', ')}. Mövcud namizədi istifadə etmək üçün adın üzərinə basın.</div>` : '';
        };
        ['fullName', 'phone', 'email'].forEach(n => form[n].addEventListener('input', check));
        check();
      },
      onSubmit: async (d, form) => {
        d.id = c.id; d.forceDuplicate = force;
        let res;
        try { res = await act('saveCandidate', d); }
        catch (e) {
          if (e.duplicateId) {
            force = true;
            throw new Error(e.message + ' Yenə də yeni namizəd yaratmaq istəyirsinizsə, "Yadda saxla" düyməsini yenidən basın.');
          }
          throw e;
        }
        if (d.vacancyId) {
          await act('addApplication', { vacancyId: d.vacancyId, candidateId: res.id }, 'Namizəd yaradıldı və vakansiyaya əlavə olundu.');
        } else toast(c.id ? 'Namizəd yeniləndi.' : 'Namizəd yaradıldı.');
        if (opt.after) opt.after(res.id);
      }
    });
  }
  function openCandidate(id) {
    const c = S.ix.cand[id];
    if (!c) return;
    const apps = appsOfCand(c.id);
    const myOpen = S.data.vacancies.filter(v => v.status === 'Açıq' && canEdit(v) && !apps.some(a => a.vacancyId === v.id));
    modal({
      title: esc(c.fullName) + ` <span class="muted small">${esc(c.id)}</span>`, size: 'lg', foot: `<button type="button" class="btn" data-close>Bağla</button>`,
      body: `<div class="grid grid-2"><dl class="kv">
          <dt>Telefon</dt><dd>${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '—'}</dd>
          <dt>Email</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</dd>
          <dt>CV</dt><dd>${c.cvUrl ? `<a href="${esc(c.cvUrl)}" target="_blank" rel="noopener">CV-ni aç ↗</a>` : '—'}</dd>
          <dt>Mənbə</dt><dd>${esc(c.source || '—')}${c.sourceNote ? ' · ' + esc(c.sourceNote) : ''}</dd>
          <dt>Ə/H gözləntisi</dt><dd>${money(c.salaryExpectation)}</dd>
          <dt>Əlavə edib</dt><dd>${esc(userName(c.createdBy))}, ${fmtD(c.createdAt)}</dd>
          ${c.note ? `<dt>Qeyd</dt><dd>${esc(c.note)}</dd>` : ''}</dl>
        <div><h3 style="margin-bottom:8px">Vakansiyalar</h3>
          ${apps.length ? `<ul class="list-plain" style="border:1px solid var(--line);border-radius:8px">${apps.map(a => `<li class="click" data-act="openApp" data-id="${a.id}" style="cursor:pointer"><div><b>${esc(vacTitle(a.vacancyId))}</b><div class="muted small">${esc((S.ix.vac[a.vacancyId] || {}).company || '')}</div></div>${stageBadge(a.stage)}</li>`).join('')}</ul>` : '<p class="muted small">Heç bir vakansiyaya əlavə olunmayıb (və ya sizin vakansiyalarınızda deyil).</p>'}
          ${myOpen.length ? `<div style="margin-top:12px;display:flex;gap:6px"><select id="addVacSel">${opts(myOpen.map(v => ({ value: v.id, label: v.title + ' — ' + v.company })))}</select><button type="button" class="btn" data-act="addCandToVac" data-id="${c.id}">Əlavə et</button></div>` : ''}
        </div></div>
        <div style="margin-top:16px"><button type="button" class="btn btn-sm" data-act="editCandidate" data-id="${c.id}">Məlumatları redaktə et</button></div>`
    });
  }
  function addToVacancyModal(vid) {
    const v = S.ix.vac[vid];
    const inVac = new Set(appsOfVac(vid).map(a => a.candidateId));
    const pool = sortBy(S.data.candidates.filter(c => !inVac.has(c.id)), c => c.fullName);
    modal({
      title: 'Namizəd əlavə et — ' + esc(v.title),
      body: `<div class="seg" style="margin-bottom:14px"><button type="button" class="active">Bazadan seç</button><button type="button" data-act="newCandForVac" data-id="${vid}">+ Yeni namizəd yarat</button></div>
        ${field('Namizəd', `<input list="candList" name="pick" placeholder="Ad və ya telefonla axtarın…"><datalist id="candList">${pool.map(c => `<option value="${esc(c.fullName)} · ${esc(c.id)}">${esc(c.phone || '')}</option>`).join('')}</datalist>`, { req: 1 })}
        ${field('Başlanğıc mərhələ', `<select name="stage">${opts(STAGES.slice(0, 5), 'Müraciət')}</select>`)}`,
      submitText: 'Əlavə et',
      onSubmit: async (d, form, close) => {
        const m = d.pick.match(/(N-\d+)\s*$/);
        if (!m) throw new Error('Siyahıdan namizəd seçin və ya yeni namizəd yaradın.');
        await act('addApplication', { vacancyId: vid, candidateId: m[1], stage: d.stage }, 'Namizəd vakansiyaya əlavə olundu.');
      }
    });
  }

  /* ======================= MƏRHƏLƏ LÖVHƏSİ ======================= */
  function viewBoard() {
    const f = S.f.board, t = today();
    const activeV = S.data.vacancies.filter(v => v.status === 'Açıq' || v.status === 'Dayandırılıb');
    let apps;
    if (f.vac) apps = appsOfVac(f.vac);
    else {
      const ids = new Set(activeV.map(v => v.id));
      apps = S.data.applications.filter(a => ids.has(a.vacancyId) || (CLOSED.includes(a.stage) && days(a.stageChangedAt, t) <= 30));
    }
    const vacOpts = sortBy(S.data.vacancies.filter(v => v.status !== 'Ləğv edildi'), v => v.status + v.title).map(v => ({ value: v.id, label: `${v.title} — ${v.company}${v.status !== 'Açıq' ? ' (' + v.status + ')' : ''}` }));
    const v = S.ix.vac[f.vac];
    return `<div class="page-head"><div><h1>Mərhələ lövhəsi</h1><div class="sub">Kartı sürüşdürərək namizədin mərhələsini dəyişin${f.vac ? '' : ' · "İşə qəbul" və "İmtina" sütunlarında son 30 gün göstərilir'}</div></div>
      <div class="actions"><select data-filter="board.vac" style="min-width:280px">${opts(vacOpts, f.vac, 'Bütün aktiv vakansiyalar')}</select>
      ${v && canEdit(v) && v.status === 'Açıq' ? `<button class="btn btn-primary" data-act="addToVacancy" data-id="${v.id}">+ Namizəd</button>` : ''}</div></div>
      <div class="board">${STAGES.map(st => {
        const items = sortBy(apps.filter(a => a.stage === st), a => a.stageChangedAt, true);
        return `<div class="col ${st === 'İşə qəbul' ? 'st-hire' : st === 'İmtina' ? 'st-reject' : ''}" data-stage="${esc(st)}">
          <div class="col-head"><span>${esc(st)}</span><span class="cnt">${items.length}</span></div>
          ${items.map(a => {
            const vv = S.ix.vac[a.vacancyId] || {};
            const next = intsOfApp(a.id).find(m => !m.attendance && m.date >= t);
            const d = days(a.stageChangedAt, t);
            return `<div class="kcard" draggable="${canEdit(vv)}" data-app="${a.id}" data-act="openApp" data-id="${a.id}">
              <div class="name">${esc(candName(a.candidateId))}</div>
              ${f.vac ? '' : `<div class="meta">${esc(vv.title)}</div>`}
              <div class="meta"><span class="${d > 7 && !CLOSED.includes(st) ? 'badge b-warn' : ''}">${d} gün</span>${scoreChip(appAvg(a.id), vv)}${next ? `<span class="badge b-info">${fmtD(next.date).slice(0, 5)} ${esc(next.startTime)}</span>` : ''}${st === 'İmtina' && a.rejectBy ? `<span>${a.rejectBy === 'Biz' ? 'Biz' : 'Namizəd'}</span>` : ''}</div>
            </div>`;
          }).join('')}</div>`;
      }).join('')}</div>`;
  }
  function wireBoard() {
    $$('.kcard[draggable=true]').forEach(card => {
      card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', card.dataset.app); card.classList.add('dragging'); });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
    $$('.col').forEach(col => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', (e) => {
        e.preventDefault(); col.classList.remove('over');
        const id = e.dataTransfer.getData('text/plain');
        if (id) changeStage(id, col.dataset.stage);
      });
    });
  }

  /* ======================= MƏRHƏLƏ DƏYİŞMƏ ======================= */
  async function changeStage(aid, stage, after) {
    const a = S.ix.app[aid];
    if (!a || a.stage === stage) return;
    const v = S.ix.vac[a.vacancyId];
    let reopen = false;
    if (CLOSED.includes(a.stage)) {
      if (!(await confirmBox('Prosesi bərpa et', `<b>${esc(candName(a.candidateId))}</b> üçün proses "${esc(a.stage)}" ilə bitib. Namizədi "${esc(stage)}" mərhələsinə qaytarmaq istəyirsiniz?`, 'Bərpa et'))) return;
      reopen = true;
    }
    const done = async (fields) => {
      const res = await act('updateApplication', { id: aid, stage, fields: fields || {}, reopen }, `Mərhələ dəyişdi: ${stage}`);
      // cari pəncərə bağlandıqdan sonra növbəti addımlar
      setTimeout(async () => {
        if (after) after();
        if (res && res.vacancyFilled) {
          if (await confirmBox('Vakansiya dolduruldu', `"${esc(v.title)}" üçün planlaşdırılan say (${esc(v.headcount)}) tamamlandı. Vakansiyanı bağlayaq?`, 'Bəli, bağla')) {
            await act('setVacancyStatus', { id: v.id, status: 'Bağlandı' }, 'Vakansiya bağlandı.').catch(e => toast(e.message, true));
            satLinkFlow(v.id);
          }
        }
      }, 0);
    };
    if (stage === 'Təklif') return offerModal(a, done);
    if (stage === 'İşə qəbul') return hireModal(a, done);
    if (stage === 'İmtina') return rejectModal(a, done);
    try { await done(); } catch (e) { toast(e.message, true); }
  }
  function offerModal(a, done, editOnly) {
    const v = S.ix.vac[a.vacancyId] || {}, c = S.ix.cand[a.candidateId] || {};
    const s = S.data.settings;
    modal({
      title: (editOnly ? 'Təklif məlumatı — ' : 'İş təklifi — ') + esc(c.fullName),
      body: `<div class="form-grid">
        ${field('Təklif tarixi', `<input type="date" name="offerDate" value="${esc(a.offerDate || today())}">`, { req: 1 })}
        ${field('Təklif olunan ə/h (AZN)', `<input type="number" name="offerSalary" min="0" step="10" value="${esc(a.offerSalary || v.salaryMax || c.salaryExpectation || '')}">`, { req: 1 })}
        ${field('Namizədin cavabı', `<select name="offerResponse">${opts(['Gözlənilir', 'Qəbul etdi', 'İmtina etdi'], a.offerResponse || 'Gözlənilir')}</select>`)}
        ${field('Cavab tarixi', `<input type="date" name="offerResponseDate" value="${esc(a.offerResponseDate || '')}">`, { attr: 'data-show="offerResponse=Qəbul etdi|İmtina etdi"' })}
        ${field('İmtina səbəbi', `<select name="offerDeclineReason">${opts(s.rejectReasonsCandidate, a.offerDeclineReason, 'Seçin…')}</select>`, { full: 1, attr: 'data-show="offerResponse=İmtina etdi"' })}
        <div class="full muted small">Ə/H aralığı: ${salaryRange(v)} · Namizədin gözləntisi: ${money(c.salaryExpectation)}</div>
      </div>`,
      onSubmit: async (d) => {
        if (d.offerResponse !== 'Gözlənilir' && !d.offerResponseDate) d.offerResponseDate = today();
        if (editOnly) return act('updateApplication', { id: a.id, fields: d }, 'Təklif məlumatı yeniləndi.').then(() => done && done());
        return done(d);
      }
    });
  }
  function hireModal(a, done) {
    const c = S.ix.cand[a.candidateId] || {}, v = S.ix.vac[a.vacancyId] || {};
    const pm = +S.data.settings.probationMonths || 3;
    modal({
      title: 'İşə qəbul — ' + esc(c.fullName),
      body: `<div class="form-grid">
        ${!a.offerDate ? field('Təklif olunan ə/h (AZN)', `<input type="number" name="offerSalary" min="0" step="10" value="${esc(v.salaryMax || c.salaryExpectation || '')}">`) + field('Təklif tarixi', `<input type="date" name="offerDate" value="${today()}">`) : ''}
        ${field('Namizədin təklifi qəbul etdiyi tarix', `<input type="date" name="offerResponseDate" value="${esc(a.offerResponseDate || today())}">`, { req: 1 })}
        ${field('İşə başlama tarixi', `<input type="date" name="hireDate" value="${esc(a.hireDate || today())}">`, { req: 1 })}
        ${field(`Sınaq müddətinin sonu (standart ${pm} ay)`, `<input type="date" name="probationEnd" value="">`)}
        <div class="full muted small">Boş saxlasanız, sınaq müddəti işə başlama tarixindən ${pm} ay sonra avtomatik təyin olunur.</div>
      </div>`,
      submitText: 'İşə qəbul et',
      onSubmit: async (d) => { d.offerResponse = 'Qəbul etdi'; if (!d.probationEnd && isDate(d.hireDate)) d.probationEnd = addMonths(d.hireDate, pm); return done(d); }
    });
  }
  function rejectModal(a, done) {
    const s = S.data.settings, c = S.ix.cand[a.candidateId] || {};
    modal({
      title: 'İmtina — ' + esc(c.fullName),
      body: `<div class="form-grid">
        <div class="full"><div class="f" style="font-size:12.5px;font-weight:600;color:var(--ink-2);margin-bottom:6px">İmtinanı kim etdi? <span class="req">*</span></div>
          <div class="seg"><label style="padding:6px 12px;cursor:pointer"><input type="radio" name="rejectBy" value="Biz" ${a.rejectBy !== 'Namizəd' ? 'checked' : ''}> Biz (şirkət)</label><label style="padding:6px 12px;cursor:pointer"><input type="radio" name="rejectBy" value="Namizəd" ${a.rejectBy === 'Namizəd' ? 'checked' : ''}> Namizəd</label></div></div>
        ${field('Səbəb', `<select name="rejectReason">${opts(s.rejectReasonsUs, a.rejectReason, 'Seçin…')}</select>`, { full: 1, req: 1, attr: 'data-show="rejectBy=Biz"' })}
        ${field('Səbəb', `<select name="rejectReason">${opts(s.rejectReasonsCandidate, a.rejectReason, 'Seçin…')}</select>`, { full: 1, req: 1, attr: 'data-show="rejectBy=Namizəd"' })}
        ${a.stage === 'Təklif' ? '<div class="full info-box">Namizəd təklif mərhələsində imtina edirsə, bu "təklifdən imtina" kimi qeyd olunur və P3 göstəricisinə təsir edir.</div>' : ''}
      </div>`,
      submitText: 'İmtina kimi qeyd et',
      onSubmit: async (d) => done(d)
    });
  }

  function openApp(aid) {
    const a = S.ix.app[aid];
    if (!a) return;
    const c = S.ix.cand[a.candidateId] || {}, v = S.ix.vac[a.vacancyId] || {};
    const t = today(), edit = canEdit(v);
    let hist = [];
    try { hist = JSON.parse(a.stageHistory || '[]'); } catch (e) { hist = []; }
    const ints = intsOfApp(a.id);
    const closed = CLOSED.includes(a.stage);
    const m = modal({
      title: esc(c.fullName) + ' — ' + esc(v.title), size: 'lg', foot: `<button type="button" class="btn" data-close>Bağla</button>`,
      body: `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px">${stageBadge(a.stage)}
          <span class="muted small">${days(a.stageChangedAt, t)} gündür bu mərhələdə</span>${scoreChip(appAvg(a.id), v)}
          <span style="margin-left:auto" class="actions">
            <a class="btn btn-sm" href="#" data-act="openCandidate" data-id="${c.id}">Namizəd kartı</a>
            <a class="btn btn-sm" href="#/vacancy/${esc(v.id)}" data-close>Vakansiya</a></span></div>
        ${edit ? `<div class="card card-pad" style="margin-bottom:16px;box-shadow:none"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <b class="small">${closed ? 'Prosesi bərpa et:' : 'Növbəti mərhələ:'}</b>
          ${STAGES.filter(st => st !== a.stage).map(st => `<button type="button" class="btn btn-sm ${st === 'İmtina' ? 'btn-danger' : ''}" data-act="stageTo" data-id="${a.id}" data-stage="${esc(st)}">${esc(st)}</button>`).join('')}
          </div></div>` : ''}
        <div class="grid grid-2">
          <div><h3 style="margin-bottom:8px">Mərhələ tarixçəsi</h3><ul class="timeline">${hist.map((h, i) => {
            const next = hist[i + 1];
            const dur = days(h.at, next ? next.at : t);
            return `<li><span class="dot" style="${h.stage === 'İmtina' ? 'background:var(--bad)' : h.stage === 'İşə qəbul' ? 'background:var(--good)' : ''}"></span><div><b>${esc(h.stage)}</b> <span class="muted small">${fmtDT(h.at)} · ${esc(userName(h.by))}</span><div class="muted small">${next || !CLOSED.includes(h.stage) ? `${dur} gün` : ''}</div></div></li>`;
          }).join('')}</ul></div>
          <div>
            ${a.offerDate || a.stage === 'Təklif' ? `<h3 style="margin-bottom:8px">Təklif</h3><dl class="kv" style="margin-bottom:14px">
              <dt>Tarix</dt><dd>${fmtD(a.offerDate)}</dd><dt>Ə/H</dt><dd>${money(a.offerSalary)}</dd>
              <dt>Cavab</dt><dd>${esc(a.offerResponse || 'Gözlənilir')}${a.offerResponseDate ? ' · ' + fmtD(a.offerResponseDate) : ''}</dd>
              ${a.offerDeclineReason ? `<dt>İmtina səbəbi</dt><dd>${esc(a.offerDeclineReason)}</dd>` : ''}</dl>
              ${edit && !closed ? `<div class="actions" style="margin-bottom:14px"><button type="button" class="btn btn-sm" data-act="editOffer" data-id="${a.id}">Təklifi redaktə et</button>
                ${a.stage === 'Təklif' ? `<button type="button" class="btn btn-sm btn-primary" data-act="stageTo" data-id="${a.id}" data-stage="İşə qəbul">Qəbul etdi → İşə qəbul</button><button type="button" class="btn btn-sm btn-danger" data-act="stageTo" data-id="${a.id}" data-stage="İmtina">İmtina etdi</button>` : ''}</div>` : ''}` : ''}
            ${a.stage === 'İşə qəbul' ? `<h3 style="margin-bottom:8px">İşə qəbul və sınaq müddəti</h3><dl class="kv"><dt>İşə başlayıb</dt><dd>${fmtD(a.hireDate)}</dd><dt>Sınaq sonu</dt><dd>${fmtD(a.probationEnd)}</dd></dl>
              ${edit ? `<div class="form-grid" style="margin-top:10px" id="probBox">
                ${field('Sınaq nəticəsi', `<select name="probationResult">${opts(['Keçdi', 'Keçmədi'], a.probationResult, 'Hələ bilinmir')}</select>`)}
                ${field('Sınaq sonu', `<input type="date" name="probationEnd" value="${esc(a.probationEnd)}">`)}
                ${field('Qeyd', `<input name="probationNote" value="${esc(a.probationNote)}">`, { full: 1 })}
                <div class="full"><button type="button" class="btn btn-sm btn-primary" data-act="saveProbation" data-id="${a.id}">Yadda saxla</button></div></div>` : `<p>${esc(a.probationResult || 'Nəticə hələ bilinmir')}</p>`}` : ''}
            ${a.stage === 'İmtina' ? `<h3 style="margin-bottom:8px">İmtina</h3><dl class="kv"><dt>Kim</dt><dd>${a.rejectBy === 'Biz' ? 'Şirkət' : 'Namizəd'}</dd><dt>Səbəb</dt><dd>${esc(a.rejectReason)}</dd></dl>` : ''}
          </div></div>
        <div style="margin-top:18px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3>Müsahibələr</h3>${edit && !closed ? `<button type="button" class="btn btn-sm btn-primary" data-act="newInterviewFor" data-id="${a.id}">+ Müsahibə</button>` : ''}</div>
          ${ints.length ? interviewTable(ints, true) : '<div class="muted small">Müsahibə yoxdur.</div>'}</div>`
    });
    m.el.dataset.app = aid;
  }
  function reopenAppModal(aid) {
    $$('.modal-back').forEach(b => { if (b.dataset.app === aid) b.remove(); });
    openApp(aid);
  }

  /* ======================= MÜSAHİBƏLƏR ======================= */
  function interviewTable(ints, compact) {
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tarix</th><th>Saat</th>${compact ? '' : '<th>Namizəd</th><th>Vakansiya</th>'}<th>Növ</th><th>Status</th><th>Nəticə</th><th>Qiymət</th></tr></thead><tbody>
      ${ints.map(m => {
        const sc = scOfInt(m.id), pend = sc.filter(s => s.status === 'Gözlənilir').length;
        return `<tr class="click" data-act="openInterview" data-id="${m.id}"><td class="nowrap">${fmtD(m.date)}</td><td class="nowrap">${esc(m.startTime)}${m.endTime ? '–' + esc(m.endTime) : ''}</td>
        ${compact ? '' : `<td><b>${esc(candName(m.candidateId))}</b></td><td class="small">${esc(vacTitle(m.vacancyId))}${isAdmin() ? `<div class="muted">${esc(userName(m.recruiterId))}</div>` : ''}</td>`}
        <td class="small">${esc(m.type || '—')}<div class="muted">${esc(m.format || '')}</div></td><td>${attBadge(m)}</td><td>${resultBadge(m.result)}</td>
        <td>${scoreChip(intAvg(m.id), S.ix.vac[m.vacancyId]) || ''}${pend ? ` <span class="badge b-warn" title="Gözləyən link">${pend} link</span>` : ''}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  }
  function weekStart(d) {
    const dt = new Date(d + 'T00:00:00Z');
    const wd = (dt.getUTCDay() + 6) % 7;
    return addDays(d, -wd);
  }
  function viewInterviews() {
    const f = S.f.int, t = today();
    if (!f.week) f.week = weekStart(t);
    const q = f.q.toLowerCase();
    let list = S.data.interviews.filter(m => {
      if (f.status === 'planned' && (m.attendance || m.date < t)) return false;
      if (f.status === 'missing' && (m.attendance || m.date >= t)) return false;
      if (f.status === 'done' && m.attendance !== 'İştirak edib') return false;
      if (f.status === 'noshow' && m.attendance !== 'İştirak etməyib') return false;
      if (q && !(`${candName(m.candidateId)} ${vacTitle(m.vacancyId)}`.toLowerCase().includes(q))) return false;
      return true;
    });
    list = sortBy(list, m => m.date + m.startTime, true);
    const head = `<div class="page-head"><div><h1>Müsahibələr</h1><div class="sub">${S.data.interviews.length} müsahibə</div></div>
      <div class="actions"><div class="seg"><button class="${f.mode === 'list' ? 'active' : ''}" data-act="intMode" data-mode="list">Siyahı</button><button class="${f.mode === 'week' ? 'active' : ''}" data-act="intMode" data-mode="week">Həftəlik təqvim</button></div>
      <button class="btn" data-act="exportInterviews">Excel-ə ixrac</button><button class="btn btn-primary" data-act="newInterview">+ Yeni müsahibə</button></div></div>`;
    if (f.mode === 'week') {
      const ws = f.week;
      const daysArr = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
      return head + `<div class="card"><div class="card-head"><div class="actions"><button class="btn btn-sm" data-act="weekNav" data-n="-7">‹ Əvvəlki</button><button class="btn btn-sm" data-act="weekNav" data-n="0">Bu həftə</button><button class="btn btn-sm" data-act="weekNav" data-n="7">Növbəti ›</button></div>
        <b>${fmtD(ws)} – ${fmtD(addDays(ws, 6))}</b></div>
        <div class="week">${daysArr.map((d, i) => {
          const evs = sortBy(S.data.interviews.filter(m => m.date === d), m => m.startTime);
          return `<div class="day ${d === t ? 'today' : ''}"><div class="day-head">${WEEKDAYS[i]}<b>${d.slice(8)}</b></div>
            ${evs.map(m => `<div class="ev ${m.attendance === 'İştirak edib' ? 'done' : m.attendance === 'İştirak etməyib' || (!m.attendance && m.date < t) ? 'miss' : ''}" data-act="openInterview" data-id="${m.id}">${esc(m.startTime)}${m.endTime ? '–' + esc(m.endTime) : ''}<b>${esc(candName(m.candidateId))}</b>${esc(vacTitle(m.vacancyId))}${isAdmin() ? `<div class="muted">${esc(userName(m.recruiterId))}</div>` : ''}</div>`).join('')}</div>`;
        }).join('')}</div></div>`;
    }
    return head + `<div class="card"><div class="filters">
        <input type="search" placeholder="Axtar: namizəd, vakansiya…" value="${esc(f.q)}" data-filter="int.q">
        <select data-filter="int.status">${opts([{ value: 'all', label: 'Hamısı' }, { value: 'planned', label: 'Planlaşdırılıb' }, { value: 'missing', label: 'Nəticə yazılmayıb' }, { value: 'done', label: 'Keçirilib' }, { value: 'noshow', label: 'Namizəd gəlmədi' }], f.status)}</select></div>
      ${list.length ? interviewTable(list, false) : '<div class="empty">Müsahibə tapılmadı.</div>'}</div>`;
  }

  function interviewForm(m, presetAppId) {
    m = m || {};
    const s = S.data.settings, t = today();
    const editableApps = S.data.applications.filter(a => { const v = S.ix.vac[a.vacancyId]; return canEdit(v) && (!CLOSED.includes(a.stage) || a.id === m.applicationId); });
    if (!m.id && !editableApps.length) {
      toast('Əvvəlcə namizədi vakansiyaya əlavə edin.', true);
      return;
    }
    const appId = m.applicationId || presetAppId || '';
    const a = S.ix.app[appId];
    const v = a ? S.ix.vac[a.vacancyId] : null;
    const appOpts = sortBy(editableApps, x => candName(x.candidateId)).map(x => ({ value: x.id, label: `${candName(x.candidateId)} — ${vacTitle(x.vacancyId)}` }));
    const sc = m.id ? scOfInt(m.id) : [];
    const edit = !m.id || canEdit(S.ix.vac[m.vacancyId]);
    const hiddenCount = sc.filter(x => x.hidden).length;
    const mine = sc.find(x => x.userId === S.data.user.id);
    const avg = m.id ? intAvg(m.id) : null;
    const scoresHtml = !m.id ? '' : `<div class="form-section">Qiymətləndirmə kartları</div>
      <div class="full">
        ${sc.length ? `<table class="tbl" style="margin-bottom:10px"><thead><tr><th>Qiymətləndirən</th><th>Status</th><th>Orta bal</th><th>Tövsiyə</th><th></th></tr></thead><tbody>
          ${sc.map(x => {
            let scores = {}; try { scores = JSON.parse(x.scores || '{}'); } catch (e) { scores = {}; }
            const detail = Object.keys(scores).map(k => `${esc(k)}: ${scores[k]}`).join(' · ');
            return `<tr><td><b>${esc(x.evaluatorName)}</b><div class="muted small">${esc(x.evaluatorRole)}</div></td>
            <td>${x.status === 'Təhvil verildi' ? '<span class="badge b-good">Təhvil verildi</span>' : '<span class="badge b-warn">Gözlənilir</span>'}</td>
            <td>${x.hidden ? '<span class="muted small" title="Hamı təhvil verəndən sonra görünəcək">🔒 gizli</span>' : (x.average !== '' ? `<b>${n1(+x.average)}</b>` : '—')}</td>
            <td class="small">${x.hidden ? '' : esc(x.recommendation || '')}</td>
            <td class="right nowrap">${x.status === 'Gözlənilir' && x.linkToken && edit ? `<button type="button" class="btn-link small" data-act="showLink" data-token="${esc(x.linkToken)}" data-who="${esc(x.evaluatorName)}" data-kind="sc">Link</button> · <button type="button" class="btn-link small" data-act="cancelLink" data-id="${esc(x.id)}" data-kind="sc" data-mid="${esc(m.id)}">Ləğv et</button>` : ''}</td></tr>
            ${!x.hidden && (detail || x.comment) ? `<tr><td colspan="5" class="small muted" style="padding-top:0">${detail}${x.comment ? `<div style="color:var(--ink-2);margin-top:3px">“${esc(x.comment)}”</div>` : ''}</td></tr>` : ''}`;
          }).join('')}</tbody></table>` : '<p class="muted small" style="margin-top:0">Hələ qiymətləndirmə yoxdur.</p>'}
        ${hiddenCount ? '<div class="info-box small" style="margin-bottom:10px">🔒 Obyektivlik üçün digər qiymətləndirmələr hamı təhvil verənə qədər gizlidir. Siz də öz kartınızı doldurun.</div>' : ''}
        ${avg != null ? `<p class="small">Orta qiymət: ${scoreChip(avg, S.ix.vac[m.vacancyId])} <span class="muted">(minimum hədd ${n1(minScoreOf(S.ix.vac[m.vacancyId]))})</span></p>` : ''}
        ${edit && m.attendance === 'İştirak edib' ? `<div class="actions"><button type="button" class="btn btn-sm" data-act="myScorecard" data-id="${m.id}">${mine ? 'Mənim qiymətləndirməmi dəyiş' : 'Mənim qiymətləndirməm'}</button>
          <button type="button" class="btn btn-sm btn-primary" data-act="scLink" data-id="${m.id}">Rəhbər üçün link yarat</button></div>` : (m.id && m.attendance !== 'İştirak edib' ? '<p class="muted small">Qiymətləndirmə müsahibə keçirildikdən sonra mümkündür.</p>' : '')}
      </div>`;
    const dis = edit ? '' : 'disabled';
    const md = modal({
      title: m.id ? `Müsahibə — ${esc(candName(m.candidateId))}` : 'Yeni müsahibə', size: 'lg',
      foot: edit ? `${m.id ? `<button type="button" class="btn btn-danger" data-act="deleteInterview" data-id="${m.id}" style="margin-right:auto">Sil</button>` : ''}<button type="button" class="btn" data-close>İmtina</button><button type="submit" class="btn btn-primary">Yadda saxla</button>` : `<button type="button" class="btn" data-close>Bağla</button>`,
      body: `<fieldset style="border:none;padding:0;margin:0" ${dis}><div class="form-grid">
        ${field('Namizəd və vakansiya', `<select name="applicationId" ${m.id ? 'disabled' : ''}>${opts(appOpts, appId, 'Seçin…')}</select>${m.id ? `<input type="hidden" name="applicationId" value="${esc(appId)}">` : ''}`, { req: 1, full: 1 })}
        ${field('Müsahibə növü', `<select name="type">${opts(s.interviewTypes, m.type || 'Panel müsahibə (qarışıq)')}</select>`)}
        ${field('Format', `<select name="format">${opts(s.formats, m.format || 'Oflayn')}</select>`)}
        ${field('Tarix', `<input type="date" name="date" value="${esc(m.date || t)}">`, { req: 1 })}
        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px">${field('Başlama', `<input type="time" name="startTime" value="${esc(m.startTime || '')}">`, { req: 1 })}${field('Bitmə', `<input type="time" name="endTime" value="${esc(m.endTime || '')}">`, { attr: 'data-hide="attendance=İştirak etməyib"' })}</div>
        ${field('İştirak edən İR əməkdaşı(ları)', `<input name="participantsHR" value="${esc(m.participantsHR || S.data.user.fullName)}">`)}
        ${field('İştirak edən struktur rəhbəri(ləri)', `<input name="participantsManagers" value="${esc(m.participantsManagers || (v ? v.hiringManager : ''))}">`)}
        ${field('Tapşırıq növü', `<select name="taskType">${opts(s.taskTypes, m.taskType || 'Yoxdur')}</select>`)}
        ${field('Tapşırıq nəticəsi', `<input name="taskResult" value="${esc(m.taskResult)}">`, { attr: `data-hide="taskType=Yoxdur|"` })}
        <div class="form-section">Nəticə ${!m.attendance ? '<span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">— müsahibədən sonra doldurun</span>' : ''}</div>
        ${field('İştirak statusu', `<select name="attendance">${opts(ATTENDANCE, m.attendance, 'Hələ keçirilməyib')}</select>`)}
        ${field('İştirak etməmə səbəbi', `<select name="absenceReason">${opts(s.absenceReasons, m.absenceReason, 'Seçin…')}</select>`, { req: 1, attr: 'data-show="attendance=İştirak etməyib"' })}
        ${field('Nəticə', `<select name="result">${opts(s.interviewResults, m.result, 'Seçin…')}</select>`, { req: 1, attr: 'data-show="attendance=İştirak edib"' })}
        ${field('Rəy', `<textarea name="comment" rows="3">${esc(m.comment)}</textarea>`, { full: 1, attr: 'data-show="attendance=İştirak edib"' })}
        ${scoresHtml}
      </div></fieldset>`,
      onSubmit: async (d) => {
        if (!edit) return;
        d.id = m.id;
        const app = S.ix.app[d.applicationId];
        if (app && d.date && d.startTime) {
          const vv = S.ix.vac[app.vacancyId];
          const st = mins(d.startTime), en = mins(d.endTime) || st + 30;
          const clash = S.data.interviews.find(x => x.id !== m.id && x.date === d.date && x.recruiterId === vv.recruiterId && x.attendance !== 'İştirak etməyib' && (() => { const a1 = mins(x.startTime), b1 = mins(x.endTime) || a1 + 30; return st < b1 && a1 < en; })());
          if (clash && !md.form._clashOk) {
            md.form._clashOk = true;
            throw new Error(`Diqqət: həmin vaxtda başqa müsahibə var — ${candName(clash.candidateId)}, ${clash.startTime}. Yenə də saxlamaq üçün "Yadda saxla" düyməsini yenidən basın.`);
          }
        }
        const wasNew = !m.id;
        const res = await act('saveInterview', d, wasNew ? 'Müsahibə yaradıldı.' : 'Müsahibə yeniləndi.');
        const appModal = $$('.modal-back').find(b => b.dataset.app === d.applicationId);
        if (appModal) setTimeout(() => reopenAppModal(d.applicationId), 0);
        if (d.attendance === 'İştirak edib' && (wasNew || !m.attendance)) {
          setTimeout(() => {
            toast('Müsahibə qeyd olundu. İndi qiymətləndirmə kartını doldura və rəhbərə link göndərə bilərsiniz.');
            interviewForm(S.ix.int[res.id]);
          }, 0);
        }
      }
    });
    md.el.dataset.int = m.id || '';
  }
  function reopenInterview(mid) {
    $$('.modal-back').forEach(b => { if (b.dataset.int === mid) b.remove(); });
    interviewForm(S.ix.int[mid]);
  }
  function scorecardForm(mid) {
    const m = S.ix.int[mid], s = S.data.settings;
    const mine = scOfInt(mid).find(x => x.userId === S.data.user.id);
    let prev = {}; try { prev = JSON.parse((mine && mine.scores) || '{}'); } catch (e) { prev = {}; }
    modal({
      title: 'Qiymətləndirmə kartı — ' + esc(candName(m.candidateId)), size: 'lg',
      body: scaleFormHtml(s.criteria, s.scale, prev, mine ? mine.recommendation : '', mine ? mine.comment : ''),
      submitText: 'Təhvil ver',
      onSubmit: async (d) => {
        const scores = {}; s.criteria.forEach((c, i) => { scores[c] = d['c' + i]; });
        await act('saveMyScorecard', { interviewId: mid, scores, recommendation: d.recommendation, comment: d.comment }, 'Qiymətləndirmə yadda saxlanıldı.');
        setTimeout(() => reopenInterview(mid), 0);
      }
    });
  }
  function scaleFormHtml(criteria, scale, prev, rec, comment) {
    return `<p class="muted small" style="margin-top:0">Hər meyar üzrə 1–5 arası bal verin. Bal vakansiyanın tələblərinə görə verilir, digər namizədlərlə müqayisəyə görə yox.</p>
      ${criteria.map((c, i) => `<div class="scale-row"><b>${esc(c)}</b><div class="scale-opts">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="c${i}" value="${n}" ${String(prev[c]) === String(n) ? 'checked' : ''}><b>${n}</b>${esc((scale || {})[n] || '')}</label>`).join('')}</div></div>`).join('')}
      <div class="form-grid" style="margin-top:14px">
        ${field('Ümumi tövsiyə', `<select name="recommendation">${opts(RECS, rec, 'Seçin…')}</select>`, { req: 1 })}
        ${field('Rəy', `<textarea name="comment" rows="3">${esc(comment || '')}</textarea>`, { full: 1 })}</div>`;
  }
  function linkUrl(token) {
    const base = location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '');
    const api = new URLSearchParams(location.search).get('api');
    return `${base}evaluate.html?t=${token}${api ? '&api=' + encodeURIComponent(api) : ''}`;
  }
  function showLink(token, who, kind) {
    const url = linkUrl(token);
    const msg = kind === 'sat'
      ? `Salam${who ? ', ' + who : ''}! Vakansiya üzrə recruiterin işini qiymətləndirməyinizi xahiş edirik (1 sual): ${url}`
      : `Salam${who ? ', ' + who : ''}! Keçirdiyimiz müsahibə üzrə namizədi qiymətləndirməyinizi xahiş edirik: ${url}`;
    modal({
      title: 'Qiymətləndirmə linki', foot: `<button type="button" class="btn btn-primary" data-close>Hazırdır</button>`,
      body: `<p style="margin-top:0"><b>${esc(who)}</b> üçün link hazırdır. Linki açan şəxs sistemə daxil olmadan qiymətləndirmə edəcək və nəticə avtomatik qeyd olunacaq. Link ${kind === 'sat' ? '' : 'bir dəfə istifadə olunur və '}30 gün etibarlıdır.</p>
        <div class="link-box"><input readonly value="${esc(url)}" id="linkInp"><button type="button" class="btn btn-sm" data-act="copy" data-text="${esc(url)}">Kopyala</button></div>
        <div class="actions" style="margin-top:12px">
          <a class="btn btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">WhatsApp ilə göndər</a>
          <a class="btn btn-sm" href="mailto:?subject=${encodeURIComponent('Qiymətləndirmə')}&body=${encodeURIComponent(msg)}">Email ilə göndər</a>
          <button type="button" class="btn btn-sm" data-act="copy" data-text="${esc(msg)}">Mesajla birlikdə kopyala</button></div>`
    });
  }

  /* ======================= PERFORMANS ======================= */
  function perfRange() {
    const f = S.f.perf, t = today();
    const ym = t.slice(0, 7);
    switch (f.preset) {
      case 'prev': { const s = addMonths(ym + '-01', -1); return [s, addDays(ym + '-01', -1)]; }
      case 'q': return [addMonths(ym + '-01', -2), t];
      case 'year': return [t.slice(0, 4) + '-01-01', t];
      case 'custom': return [f.from || ym + '-01', f.to || t];
      default: return [ym + '-01', t];
    }
  }
  async function loadPerformance() {
    if (S.perf) return;
    const [from, to] = perfRange();
    const key = from + to + S.f.perf.company;
    if (S._perfLoading === key) return;
    S._perfLoading = key;
    try {
      S.perf = await call('performance', { from, to, company: S.f.perf.company });
      S._perfLoading = null;
      if (routeParts()[0] === 'performance') { const y = window.scrollY; $('#main').innerHTML = viewPerformance(); window.scrollTo(0, y); }
    } catch (e) { S._perfLoading = null; if (e.auth) return logout(true); toast(e.message, true); }
  }
  function viewPerformance() {
    const f = S.f.perf, s = S.data.settings;
    const [from, to] = perfRange();
    const head = `<div class="page-head"><div><h1>Performans</h1><div class="sub">${fmtD(from)} – ${fmtD(to)} · ${isAdmin() ? 'bütün recruiterlər' : 'sizin göstəriciləriniz'}</div></div>
      <div class="actions">
        <select data-filter="perf.preset">${opts([{ value: 'month', label: 'Bu ay' }, { value: 'prev', label: 'Keçən ay' }, { value: 'q', label: 'Son 3 ay' }, { value: 'year', label: 'Bu il' }, { value: 'custom', label: 'Xüsusi dövr' }], f.preset)}</select>
        ${f.preset === 'custom' ? `<input type="date" value="${esc(from)}" data-filter="perf.from" style="width:auto"><input type="date" value="${esc(to)}" data-filter="perf.to" style="width:auto">` : ''}
        <select data-filter="perf.company">${opts(s.companies, f.company, 'Bütün şirkətlər')}</select>
        <button class="btn" data-act="exportPerf" ${S.perf ? '' : 'disabled'}>Excel-ə ixrac</button></div></div>`;
    if (!S.perf) return head + '<div class="card empty">Hesablanır…</div>';
    const P = S.perf, keys = Object.keys(METRICS);
    if (!P.rows.length) return head + '<div class="card empty">Bu dövr üçün məlumat yoxdur.</div>';
    const sel = P.rows.find(r => r.recruiterId === f.sel) || P.rows[0];
    const table = `<div class="card" style="margin-bottom:16px"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Recruiter</th><th>Ümumi bal</th>${keys.map(k => `<th class="right" title="${esc(METRICS[k].name)}">${k}</th>`).join('')}<th class="right">Müsahibə</th><th class="right">İşə qəbul</th><th class="right">Aktiv vak.</th></tr></thead><tbody>
      ${P.rows.map(r => `<tr class="click" data-act="perfSel" data-id="${r.recruiterId}" ${r === sel ? 'style="background:#f3fafa"' : ''}><td><b>${esc(r.name)}</b></td>
        <td style="min-width:170px">${r.total == null ? '<span class="muted small">Kifayət qədər məlumat yoxdur</span>' : `<div style="display:flex;align-items:center;gap:8px"><span class="score ${scoreCls(r.total)}">${scoreTxt(r.total)}</span><div class="bar" style="flex:1"><i style="width:${r.total}%"></i></div></div>`}</td>
        ${keys.map(k => { const mt = r.metrics[k]; return `<td class="right"><span class="score ${scoreCls(mt.n ? mt.score : null)}" title="${mt.n ? esc(n1(mt.value) + ' ' + mt.unit + ' · n=' + mt.n) : 'məlumat yoxdur'}">${mt.n ? scoreTxt(mt.score) : '—'}</span></td>`; }).join('')}
        <td class="right num">${r.info.interviews}</td><td class="right num">${r.info.hires}</td><td class="right num">${r.info.activeVacancies}</td></tr>`).join('')}
      </tbody></table></div><div class="card-pad small muted" style="padding-top:10px">Xanalarda 0–100 arası bal göstərilir. Faktiki dəyəri görmək üçün siçanı xananın üzərinə gətirin və ya recruiteri seçin. — işarəsi həmin göstərici üçün dövrdə məlumat olmadığını bildirir; onun çəkisi digər göstəricilərə bölünür.</div></div>`;
    const t = P.targets;
    const targetTxt = { P1: `hədəf ≥ ${t.P1}%`, P2: `hədəf: ${Object.entries(s.targetDays || {}).map(([k, v]) => `${k} ${v}`).join(' / ')} gün`, P3: `hədəf ≥ ${t.P3}%`, P4: `hədəf ≥ ${t.P4}%`, P5: `hədəf ≥ ${t.P5}`, P6: `hədəf ≤ ${t.P6}%`, P7: `hədəf ≥ ${t.P7}%`, P8: `hədəf ≥ ${t.P8}%` };
    const info = sel.info;
    const maxF = Math.max(1, ...info.funnel.map(x => x.count));
    const detail = `<div class="page-head" style="margin-top:8px"><h2>${esc(sel.name)} — ətraflı</h2>${sel.total != null ? `<span class="score ${scoreCls(sel.total)}" style="font-size:18px;padding:6px 12px">${scoreTxt(sel.total)} / 100</span>` : '<span class="badge b-warn">Kifayət qədər məlumat yoxdur</span>'}</div>
      <div class="grid grid-4" style="margin-bottom:16px">${keys.map(k => { const mt = sel.metrics[k]; return `<div class="card metric-card"><div class="mt"><span>${k}. ${esc(METRICS[k].name)}</span><span class="muted small">${mt.weight}%</span></div>
        <div class="mv">${mt.n ? n1(mt.value) + ' <span class="small muted">' + esc(mt.unit) + '</span>' : '—'}</div>
        <div class="md">${esc(targetTxt[k])} · n=${mt.n || 0}</div>
        <div style="margin-top:8px;display:flex;align-items:center;gap:8px"><span class="score ${scoreCls(mt.n ? mt.score : null)}">${mt.n ? scoreTxt(mt.score) : '—'}</span><div class="bar" style="flex:1"><i style="width:${mt.n ? mt.score : 0}%"></i></div></div></div>`; }).join('')}</div>
      <div class="grid grid-3" style="margin-bottom:16px">
        <div class="card card-pad"><h3 style="margin-bottom:10px">İş həcmi</h3><dl class="kv" style="grid-template-columns:1fr auto">
          <dt>Aktiv vakansiya</dt><dd class="num">${info.activeVacancies}</dd><dt>Dövrdə açılan</dt><dd class="num">${info.newVacancies}</dd><dt>Dövrdə bağlanan</dt><dd class="num">${info.closedVacancies}</dd>
          <dt>Müsahibə (keçirilən)</dt><dd class="num">${info.interviews} (${info.attended})</dd><dt>Namizəd gəlmədi</dt><dd class="num">${info.noShows}</dd>
          <dt>Ümumi müsahibə vaxtı</dt><dd class="num">${Math.floor(info.totalMinutes / 60)} saat ${info.totalMinutes % 60} dəq</dd><dt>Orta müsahibə</dt><dd class="num">${info.avgMinutes == null ? '—' : info.avgMinutes + ' dəq'}</dd>
          <dt>İşə qəbul</dt><dd class="num">${info.hires}</dd><dt>Bir işə qəbula müsahibə</dt><dd class="num">${n1(info.interviewsPerHire)}</dd></dl></div>
        <div class="card card-pad"><h3 style="margin-bottom:10px">Namizəd axını</h3><div class="muted small" style="margin-bottom:10px">Dövrdə əlavə olunan namizədlərdən hansı mərhələyə çatanlar</div>
          ${info.funnel.map(x => `<div class="funnel-row"><span class="small">${esc(x.stage)}</span><div class="bar"><i style="width:${x.count / maxF * 100}%"></i></div><span class="num small right">${x.count}</span></div>`).join('')}</div>
        <div class="card card-pad"><h3 style="margin-bottom:10px">Son 6 ay</h3>${trendSvg(sel.trend)}</div></div>
      <div class="grid grid-2" style="margin-bottom:16px">
        <div class="card"><div class="card-head"><h3>Mənbələr</h3></div>${info.sources.length ? `<table class="tbl"><thead><tr><th>Mənbə</th><th class="right">Namizəd</th><th class="right">İşə qəbul</th></tr></thead><tbody>${info.sources.map(x => `<tr><td>${esc(x.source)}</td><td class="right num">${x.applications}</td><td class="right num">${x.hires}</td></tr>`).join('')}</tbody></table>` : '<div class="empty small">Məlumat yoxdur.</div>'}</div>
        <div class="card"><div class="card-head"><h3>İmtina səbəbləri</h3></div>${info.rejectReasons.length ? `<table class="tbl"><tbody>${info.rejectReasons.map(x => `<tr><td>${esc(x.reason)}</td><td class="right num">${x.count}</td></tr>`).join('')}</tbody></table>` : '<div class="empty small">Məlumat yoxdur.</div>'}</div></div>
      <details class="card card-pad"><summary style="cursor:pointer;font-weight:600">Göstəricilər necə hesablanır?</summary>
        <div class="small" style="margin-top:10px">Hər göstərici hədəfə görə 0–100 bal alır, sonra çəkiyə görə toplanır. Dövrdə məlumatı olmayan göstəricinin çəkisi digərlərinə bölünür. Ümumi bal yalnız ən azı ${esc(s.minInterviews)} müsahibə və ya 1 bağlanmış vakansiya, eləcə də ən azı 2 göstəricidə məlumat olduqda hesablanır.
        <ul>${keys.map(k => `<li><b>${k}. ${esc(METRICS[k].name)}</b> (${esc(P.weights[k])}%): ${esc(METRICS[k].desc)}</li>`).join('')}</ul></div></details>`;
    return head + table + detail;
  }
  function trendSvg(tr) {
    const W = 300, H = 140, pad = 24;
    const pts = tr.map((x, i) => ({ x: pad + i * (W - pad * 2) / Math.max(1, tr.length - 1), y: x.total == null ? null : H - pad - (x.total / 100) * (H - pad * 2), v: x.total, m: x.month }));
    const segs = []; let cur = [];
    pts.forEach(p => { if (p.y == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push(p); });
    if (cur.length) segs.push(cur);
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Son 6 ayın bal dinamikası">
      ${[0, 50, 100].map(v => { const y = H - pad - v / 100 * (H - pad * 2); return `<line x1="${pad}" x2="${W - pad}" y1="${y}" y2="${y}" stroke="#e3e8ed"/><text x="2" y="${y + 4}" font-size="10" fill="#7c8a97">${v}</text>`; }).join('')}
      ${segs.map(sg => `<polyline fill="none" stroke="#0f6e78" stroke-width="2.5" points="${sg.map(p => p.x + ',' + p.y).join(' ')}"/>`).join('')}
      ${pts.map(p => `${p.y != null ? `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#0f6e78"><title>${p.m}: ${p.v}</title></circle><text x="${p.x}" y="${p.y - 8}" font-size="10" text-anchor="middle" fill="#18222d">${Math.round(p.v)}</text>` : ''}<text x="${p.x}" y="${H - 6}" font-size="10" text-anchor="middle" fill="#7c8a97">${MONTHS[+p.m.slice(5) - 1].slice(0, 3)}</text>`).join('')}
    </svg>${pts.every(p => p.y == null) ? '<div class="muted small">Hələ kifayət qədər məlumat yoxdur.</div>' : ''}`;
  }

  /* ======================= ADMİN ======================= */
  async function loadAudit() {
    try { S.audit = await call('auditLog', {}); if (routeParts()[0] === 'admin') $('#main').innerHTML = viewAdmin(); }
    catch (e) { toast(e.message, true); }
  }
  function viewAdmin() {
    const tab = S.f.admin.tab;
    const tabs = [['users', 'İstifadəçilər'], ['lists', 'Siyahılar'], ['params', 'Performans parametrləri'], ['audit', 'Dəyişiklik tarixçəsi']];
    const head = `<div class="page-head"><div><h1>Admin</h1><div class="sub">İstifadəçilər, siyahılar və performans parametrləri</div></div></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'active' : ''}" data-act="adminTab" data-tab="${k}">${l}</button>`).join('')}</div>`;
    const s = S.data.settings;
    if (tab === 'users') {
      return head + `<div class="card"><div class="card-head"><h3>İstifadəçilər</h3><button class="btn btn-primary" data-act="newUser">+ Yeni istifadəçi</button></div>
        <table class="tbl"><thead><tr><th>Ad, soyad</th><th>İstifadəçi adı</th><th>Rol</th><th>Status</th><th></th></tr></thead><tbody>
        ${S.data.users.map(u => `<tr><td><b>${esc(u.fullName)}</b></td><td>${esc(u.username)}</td><td>${u.role === 'admin' ? 'Admin' : 'Recruiter'}</td>
          <td>${u.active ? (u.mustChange ? '<span class="badge b-warn">Parolu dəyişməlidir</span>' : '<span class="badge b-good">Aktiv</span>') : '<span class="badge">Deaktiv</span>'}</td>
          <td class="right nowrap"><button class="btn btn-sm" data-act="editUser" data-id="${u.id}">Redaktə</button> <button class="btn btn-sm" data-act="resetPw" data-id="${u.id}">Parolu sıfırla</button></td></tr>`).join('')}
        </tbody></table></div>`;
    }
    if (tab === 'lists') {
      const L = [['companies', 'Şirkətlər'], ['departments', 'Struktur bölmələr'], ['sources', 'Namizədin tapılma mənbələri'], ['interviewTypes', 'Müsahibə növləri'], ['formats', 'Müsahibə formatları'], ['taskTypes', 'Tapşırıq növləri'], ['interviewResults', 'Müsahibə nəticələri'], ['absenceReasons', 'İştirak etməmə səbəbləri'], ['rejectReasonsUs', 'İmtina səbəbləri (şirkət)'], ['rejectReasonsCandidate', 'İmtina səbəbləri (namizəd)'], ['criteria', 'Qiymətləndirmə meyarları']];
      return head + `<form class="card card-pad" id="listsForm"><p class="muted small" style="margin-top:0">Hər sətirdə bir dəyər yazın. Dəyişiklik köhnə qeydlərə təsir etmir.</p>
        <div class="grid grid-3">${L.map(([k, l]) => field(l, `<textarea name="${k}" rows="6">${esc((s[k] || []).join('\n'))}</textarea>`)).join('')}</div>
        <h3 style="margin:18px 0 8px">Qiymətləndirmə şkalası (1–5)</h3>
        <div class="grid grid-3">${[1, 2, 3, 4, 5].map(n => field(String(n), `<input name="scale${n}" value="${esc((s.scale || {})[n] || '')}">`)).join('')}</div>
        <div style="margin-top:16px"><button class="btn btn-primary" type="button" data-act="saveLists">Yadda saxla</button></div></form>`;
    }
    if (tab === 'params') {
      const w = s.weights, t = s.targets;
      return head + `<form class="card card-pad" id="paramsForm">
        <h3 style="margin-bottom:6px">Göstəricilərin çəkisi</h3><p class="muted small" style="margin-top:0">Cəmi 100 olmalıdır. Hazırda: <b id="wsum"></b></p>
        <div class="grid grid-4">${Object.keys(METRICS).map(k => field(`${k}. ${METRICS[k].name}`, `<input type="number" min="0" max="100" name="w_${k}" value="${esc(w[k])}" class="wInp">`)).join('')}</div>
        <h3 style="margin:18px 0 6px">Hədəflər</h3>
        <div class="grid grid-4">
          ${field('P1 vaxtında bağlanma (%)', `<input type="number" name="t_P1" value="${esc(t.P1)}">`)}
          ${field('P3 təklifin qəbulu (%)', `<input type="number" name="t_P3" value="${esc(t.P3)}">`)}
          ${field('P4 sınağı keçmə (%)', `<input type="number" name="t_P4" value="${esc(t.P4)}">`)}
          ${field('P5 rəhbər məmnuniyyəti (1–5)', `<input type="number" step="0.1" name="t_P5" value="${esc(t.P5)}">`)}
          ${field('P6 gəlməmə (maks. %)', `<input type="number" name="t_P6" value="${esc(t.P6)}">`)}
          ${field('P7 vaxtında daxil etmə (%)', `<input type="number" name="t_P7" value="${esc(t.P7)}">`)}
          ${field('P8 bağlama faizi (%)', `<input type="number" name="t_P8" value="${esc(t.P8)}">`)}</div>
        <h3 style="margin:18px 0 6px">Bağlanma müddəti hədəfi (gün) — P2</h3>
        <div class="grid grid-4">${DIFFICULTY.map(d => field(d, `<input type="number" name="d_${d}" value="${esc((s.targetDays || {})[d])}">`)).join('')}</div>
        <h3 style="margin:18px 0 6px">Digər</h3>
        <div class="grid grid-4">
          ${field('Sınaq müddəti (ay)', `<input type="number" name="probationMonths" value="${esc(s.probationMonths)}">`)}
          ${field('Nəticəni daxil etmə limiti (gün)', `<input type="number" name="timelyEntryDays" value="${esc(s.timelyEntryDays)}">`)}
          ${field('Bal üçün minimum müsahibə sayı', `<input type="number" name="minInterviews" value="${esc(s.minInterviews)}">`)}
          ${field('Standart minimum qiymət (1–5)', `<input type="number" step="0.1" name="defaultMinScore" value="${esc(s.defaultMinScore)}">`)}</div>
        <div style="margin-top:16px"><button class="btn btn-primary" type="button" data-act="saveParams">Yadda saxla</button></div></form>`;
    }
    const log = S.audit;
    return head + `<div class="card">${!log ? '<div class="empty">Yüklənir…</div>' : `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Vaxt</th><th>İstifadəçi</th><th>Əməliyyat</th><th>Obyekt</th><th>Detallar</th></tr></thead><tbody>
      ${log.map(l => `<tr><td class="nowrap small">${fmtDT(l.ts)}</td><td class="small">${esc(l.userName)}</td><td>${esc(l.action)}</td><td class="small muted">${esc(l.entityId)}</td><td class="small">${esc(l.details)}</td></tr>`).join('')}</tbody></table></div>`}</div>`;
  }
  function wireWeights() {
    const upd = () => { const sum = $$('.wInp').reduce((a, i) => a + (+i.value || 0), 0); const el = $('#wsum'); if (el) { el.textContent = sum; el.style.color = sum === 100 ? 'var(--good)' : 'var(--bad)'; } };
    $$('.wInp').forEach(i => i.addEventListener('input', upd));
    upd();
  }
  function userForm(u) {
    u = u || {};
    modal({
      title: u.id ? 'İstifadəçini redaktə et' : 'Yeni istifadəçi',
      body: `<div class="form-grid">
        ${field('Ad, soyad, ata adı', `<input name="fullName" value="${esc(u.fullName)}">`, { req: 1, full: 1 })}
        ${field('İstifadəçi adı (latın hərfləri)', `<input name="username" value="${esc(u.username)}" placeholder="məs. sebnem.rzayeva" autocapitalize="none">`, { req: 1 })}
        ${field('Rol', `<select name="role">${opts([{ value: 'recruiter', label: 'Recruiter' }, { value: 'admin', label: 'Admin' }], u.role || 'recruiter')}</select>`)}
        ${u.id ? field('Status', `<select name="activeSel">${opts([{ value: '1', label: 'Aktiv' }, { value: '0', label: 'Deaktiv' }], u.active === false ? '0' : '1')}</select>`) : '<div class="full info-box">Yadda saxladıqdan sonra müvəqqəti parol göstəriləcək. İstifadəçi ilk girişdə onu dəyişəcək.</div>'}
      </div>`,
      onSubmit: async (d) => {
        d.id = u.id; d.active = d.activeSel !== '0';
        const res = await act('saveUser', d, u.id ? 'İstifadəçi yeniləndi.' : '');
        if (res.tempPassword) setTimeout(() => showTempPw(res.username, res.tempPassword), 0);
      }
    });
  }
  function showTempPw(username, pw) {
    const text = `Platforma: ${location.href.split('#')[0]}\nİstifadəçi adı: ${username}\nMüvəqqəti parol: ${pw}`;
    modal({
      title: 'Giriş məlumatları', foot: `<button type="button" class="btn btn-primary" data-close>Hazırdır</button>`,
      body: `<p style="margin-top:0">Bu məlumatları istifadəçiyə ötürün. Parol yalnız indi göstərilir — sonra yalnız sıfırlamaq mümkündür.</p>
        <dl class="kv" style="font-size:15px"><dt>İstifadəçi adı</dt><dd><code>${esc(username)}</code></dd><dt>Müvəqqəti parol</dt><dd><code style="font-size:17px">${esc(pw)}</code></dd></dl>
        <button type="button" class="btn" style="margin-top:14px" data-act="copy" data-text="${esc(text)}">Hamısını kopyala</button>`
    });
  }

  /* ======================= İXRAC ======================= */
  function exportRows(name, headers, rows) {
    const file = `${name}_${today()}`;
    if (window.XLSX) {
      const ws = window.XLSX.utils.aoa_to_sheet([headers].concat(rows));
      ws['!cols'] = headers.map((h, i) => ({ wch: Math.min(50, Math.max(String(h).length, ...rows.map(r => String(r[i] == null ? '' : r[i]).length)) + 2) }));
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 30));
      window.XLSX.writeFile(wb, file + '.xlsx');
      return;
    }
    const csv = '﻿' + [headers].concat(rows).map(r => r.map(c => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = file + '.csv';
    a.click();
  }
  const EXPORTS = {
    exportVacancies() {
      exportRows('Vakansiyalar', ['ID', 'Vakansiya', 'Şirkət', 'Bölmə', 'Rəhbər', 'Recruiter', 'Say', 'Ə/H min', 'Ə/H max', 'Çətinlik', 'Prioritet', 'Açılıb', 'Son tarix', 'Status', 'Bağlanıb', 'Dayandırılmış gün', 'Namizəd sayı', 'İşə qəbul'],
        filteredVacancies().map(v => [v.id, v.title, v.company, v.department, v.hiringManager, userName(v.recruiterId), +v.headcount, v.salaryMin, v.salaryMax, v.difficulty, v.priority, v.openedAt, v.deadline, v.status, v.closedAt, +v.pausedDays || 0, appsOfVac(v.id).length, appsOfVac(v.id).filter(a => a.stage === 'İşə qəbul').length]));
    },
    exportCandidates() {
      exportRows('Namizədlər', ['ID', 'Ad, soyad', 'Telefon', 'Email', 'CV', 'Mənbə', 'Mənbə qeydi', 'Ə/H gözləntisi', 'Vakansiyalar', 'Əlavə olunub'],
        S.data.candidates.map(c => [c.id, c.fullName, c.phone, c.email, c.cvUrl, c.source, c.sourceNote, c.salaryExpectation, appsOfCand(c.id).map(a => `${vacTitle(a.vacancyId)} (${a.stage})`).join('; '), toDay(c.createdAt)]));
    },
    exportInterviews() {
      exportRows('Müsahibələr', ['ID', 'Tarix', 'Başlama', 'Bitmə', 'Namizəd', 'Vakansiya', 'Şirkət', 'Recruiter', 'Növ', 'Format', 'İR iştirakçılar', 'Rəhbərlər', 'Tapşırıq', 'Tapşırıq nəticəsi', 'İştirak', 'Gəlməmə səbəbi', 'Nəticə', 'Orta qiymət', 'Rəy', 'Nəticə daxil edilib'],
        sortBy(S.data.interviews, m => m.date + m.startTime).map(m => { const v = S.ix.vac[m.vacancyId] || {}; const avg = intAvg(m.id); return [m.id, m.date, m.startTime, m.endTime, candName(m.candidateId), v.title, v.company, userName(m.recruiterId), m.type, m.format, m.participantsHR, m.participantsManagers, m.taskType, m.taskResult, m.attendance, m.absenceReason, m.result, avg == null ? '' : Math.round(avg * 100) / 100, m.comment, toDay(m.resultEnteredAt)]; }));
    },
    exportPerf() {
      if (!S.perf) return;
      const keys = Object.keys(METRICS);
      exportRows('Performans', ['Recruiter', 'Ümumi bal'].concat(keys.map(k => `${k} ${METRICS[k].name} — dəyər`), keys.map(k => `${k} bal`), ['Müsahibə', 'Keçirilən', 'Gəlməyən', 'İşə qəbul', 'Aktiv vakansiya', 'Bağlanan vakansiya']),
        S.perf.rows.map(r => [r.name, r.total == null ? 'Məlumat azdır' : r.total].concat(keys.map(k => r.metrics[k].n ? r.metrics[k].value : ''), keys.map(k => r.metrics[k].n ? r.metrics[k].score : ''), [r.info.interviews, r.info.attended, r.info.noShows, r.info.hires, r.info.activeVacancies, r.info.closedVacancies])));
    }
  };

  /* ======================= HADİSƏLƏR ======================= */
  const ACTIONS = Object.assign({
    pw: () => passwordModal(false),
    logout: () => logout(false),
    newVacancy: () => vacancyForm(),
    editVacancy: (el) => vacancyForm(S.ix.vac[el.dataset.id]),
    vacStatus: (el) => changeVacancyStatus(el.dataset.id, el.dataset.status),
    satLink: (el) => satLinkFlow(el.dataset.id),
    addToVacancy: (el) => addToVacancyModal(el.dataset.id),
    newCandForVac: (el) => { el.closest('.modal-back').remove(); candidateForm(null, { vacancyId: el.dataset.id }); },
    boardFor: (el) => { S.f.board.vac = el.dataset.id; },
    newCandidate: () => candidateForm(),
    editCandidate: (el) => { el.closest('.modal-back').remove(); candidateForm(S.ix.cand[el.dataset.id]); },
    openCandidate: (el) => openCandidate(el.dataset.id),
    useCandidate: async (el) => {
      const back = el.closest('.modal-back');
      const vac = el.dataset.vac || (back.querySelector('[name=vacancyId]') || {}).value;
      back.remove();
      if (vac) await act('addApplication', { vacancyId: vac, candidateId: el.dataset.id }, 'Mövcud namizəd vakansiyaya əlavə olundu.').catch(e => toast(e.message, true));
      else openCandidate(el.dataset.id);
    },
    addCandToVac: async (el) => {
      const vid = $('#addVacSel').value;
      const back = el.closest('.modal-back');
      try { await act('addApplication', { vacancyId: vid, candidateId: el.dataset.id }, 'Namizəd vakansiyaya əlavə olundu.'); back.remove(); openCandidate(el.dataset.id); }
      catch (e) { toast(e.message, true); }
    },
    openApp: (el) => openApp(el.dataset.id),
    stageTo: (el) => { const id = el.dataset.id; changeStage(id, el.dataset.stage, () => reopenAppModal(id)); },
    editOffer: (el) => { const id = el.dataset.id; offerModal(S.ix.app[id], () => reopenAppModal(id), true); },
    saveProbation: async (el) => {
      const box = $('#probBox'); const d = formData(box);
      try { await act('updateApplication', { id: el.dataset.id, fields: d }, 'Sınaq məlumatı yadda saxlanıldı.'); reopenAppModal(el.dataset.id); }
      catch (e) { toast(e.message, true); }
    },
    newInterview: () => interviewForm(),
    newInterviewFor: (el) => interviewForm(null, el.dataset.id),
    openInterview: (el) => { const m = S.ix.int[el.dataset.id]; if (m) interviewForm(m); },
    deleteInterview: async (el) => {
      if (!(await confirmBox('Müsahibəni sil', 'Bu müsahibə silinəcək. Davam edilsin?', 'Sil', true))) return;
      try { await act('deleteInterview', { id: el.dataset.id }, 'Müsahibə silindi.'); $$('.modal-back').forEach(b => { if (b.dataset.int === el.dataset.id) b.remove(); }); }
      catch (e) { toast(e.message, true); }
    },
    myScorecard: (el) => scorecardForm(el.dataset.id),
    scLink: (el) => {
      const mid = el.dataset.id, m = S.ix.int[mid];
      const names = String(m.participantsManagers || '').split(/[;,]/).map(x => x.trim()).filter(Boolean);
      const done = new Set(scOfInt(mid).map(s => s.evaluatorName));
      modal({
        title: 'Rəhbər üçün qiymətləndirmə linki',
        body: `<p class="muted small" style="margin-top:0">Hər qiymətləndirən üçün ayrıca link yaradılır. Rəhbər linki açıb namizədi meyarlar üzrə qiymətləndirəcək — hesab və parol lazım deyil.</p>
          ${field('Qiymətləndirən şəxs', `<input name="evaluatorName" list="mgrList" value="${esc(names.find(n => !done.has(n)) || '')}"><datalist id="mgrList">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`, { req: 1 })}
          <div style="margin-top:12px">${field('Vəzifəsi', `<select name="evaluatorRole">${opts(['Struktur bölmə rəhbəri', 'İR əməkdaşı', 'Digər'], 'Struktur bölmə rəhbəri')}</select>`)}</div>`,
        submitText: 'Link yarat',
        onSubmit: async (d) => {
          const res = await act('createScorecardLink', { interviewId: mid, evaluatorName: d.evaluatorName, evaluatorRole: d.evaluatorRole });
          setTimeout(() => { reopenInterview(mid); showLink(res.token, d.evaluatorName, 'sc'); }, 0);
        }
      });
    },
    showLink: (el) => showLink(el.dataset.token, el.dataset.who, el.dataset.kind),
    cancelLink: async (el) => {
      if (!(await confirmBox('Linki ləğv et', 'Link etibarsız olacaq. Davam edilsin?', 'Ləğv et', true))) return;
      try { await act('cancelLink', { id: el.dataset.id, kind: el.dataset.kind }, 'Link ləğv edildi.'); if (el.dataset.mid) reopenInterview(el.dataset.mid); }
      catch (e) { toast(e.message, true); }
    },
    copy: async (el) => {
      try { await navigator.clipboard.writeText(el.dataset.text); toast('Kopyalandı.'); }
      catch (e) { const i = document.createElement('textarea'); i.value = el.dataset.text; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); toast('Kopyalandı.'); }
    },
    intMode: (el) => { S.f.int.mode = el.dataset.mode; render(); },
    weekNav: (el) => { const n = +el.dataset.n; S.f.int.week = n === 0 ? weekStart(today()) : addDays(S.f.int.week, n); render(); },
    perfSel: (el) => { S.f.perf.sel = el.dataset.id; $('#main').innerHTML = viewPerformance(); },
    adminTab: (el) => { S.f.admin.tab = el.dataset.tab; if (el.dataset.tab === 'audit') S.audit = null; render(); },
    newUser: () => userForm(),
    editUser: (el) => userForm(S.data.users.find(u => u.id === el.dataset.id)),
    resetPw: async (el) => {
      const u = S.data.users.find(x => x.id === el.dataset.id);
      if (!(await confirmBox('Parolu sıfırla', `<b>${esc(u.fullName)}</b> üçün yeni müvəqqəti parol yaradılacaq. Köhnə parol işləməyəcək.`, 'Sıfırla'))) return;
      try { const res = await act('resetPassword', { id: u.id }); showTempPw(res.username, res.tempPassword); } catch (e) { toast(e.message, true); }
    },
    saveLists: async () => {
      const d = formData($('#listsForm'));
      const payload = {};
      ['companies', 'departments', 'sources', 'interviewTypes', 'formats', 'taskTypes', 'interviewResults', 'absenceReasons', 'rejectReasonsUs', 'rejectReasonsCandidate', 'criteria'].forEach(k => { payload[k] = lines(d[k]); });
      if (payload.criteria.length < 1) return toast('Ən azı bir qiymətləndirmə meyarı olmalıdır.', true);
      payload.scale = {}; [1, 2, 3, 4, 5].forEach(n => { payload.scale[n] = d['scale' + n]; });
      try { await act('saveSettings', payload, 'Siyahılar yadda saxlanıldı.'); } catch (e) { toast(e.message, true); }
    },
    saveParams: async () => {
      const d = formData($('#paramsForm'));
      const weights = {}, targets = {}, targetDays = {};
      Object.keys(METRICS).forEach(k => { weights[k] = +d['w_' + k] || 0; });
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      if (sum !== 100) return toast(`Çəkilərin cəmi 100 olmalıdır (hazırda ${sum}).`, true);
      ['P1', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'].forEach(k => { targets[k] = +d['t_' + k]; });
      if (Object.values(targets).some(x => !(x > 0))) return toast('Hədəflər müsbət ədəd olmalıdır.', true);
      DIFFICULTY.forEach(x => { targetDays[x] = +d['d_' + x] || 30; });
      try {
        await act('saveSettings', { weights, targets, targetDays, probationMonths: +d.probationMonths || 3, timelyEntryDays: +d.timelyEntryDays || 1, minInterviews: +d.minInterviews || 0, defaultMinScore: +d.defaultMinScore || 3 }, 'Parametrlər yadda saxlanıldı.');
      } catch (e) { toast(e.message, true); }
    }
  }, EXPORTS);

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !ACTIONS[el.dataset.act]) return;
    if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
    if (el.dataset.act === 'boardFor') { ACTIONS.boardFor(el); return; }
    if (el.classList.contains('kcard') && el.classList.contains('dragging')) return;
    e.stopPropagation();
    Promise.resolve(ACTIONS[el.dataset.act](el, e)).catch(err => toast(err.message, true));
  });
  // filtrlər
  let filterTimer;
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-filter]');
    if (!el) return;
    const [grp, key] = el.dataset.filter.split('.');
    S.f[grp][key] = el.value;
    if (grp === 'perf') { S.perf = null; }
    clearTimeout(filterTimer);
    const isText = el.type === 'search';
    filterTimer = setTimeout(() => {
      const pos = isText ? el.selectionStart : null;
      render();
      if (isText) { const n = $(`[data-filter="${el.dataset.filter}"]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) { /* */ } } }
    }, isText ? 200 : 0);
  });

  /* ======================= BAŞLANĞIC ======================= */
  async function boot() {
    if (!store.get('rp_token')) return renderLogin();
    $('#root').innerHTML = '<div class="login-wrap"><div class="muted">Yüklənir…</div></div>';
    try {
      applyBundle(await call('loadAll', {}));
      shell();
      render();
      if (S.data.user.mustChange) passwordModal(true);
    } catch (e) {
      if (e.auth) return logout(true);
      renderLogin(e.message);
    }
  }
  boot();
})();
