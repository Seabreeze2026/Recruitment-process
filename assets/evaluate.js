// Rəhbərin linklə açdığı qiymətləndirmə səhifəsi (giriş tələb olunmur)
(function () {
  const { call, esc } = window.RP;
  const box = document.getElementById('ev');
  const token = new URLSearchParams(location.search).get('t') || '';

  const done = (title, text) => { box.innerHTML = `<h2 style="margin-bottom:8px">${esc(title)}</h2><p class="muted" style="margin:0">${esc(text)}</p>`; };
  const fail = (msg) => { box.innerHTML = `<div class="err-box">${esc(msg)}</div>`; };

  async function load() {
    if (!token) return fail('Link natamamdır. Zəhmət olmasa, sizə göndərilən linki tam açın.');
    let f;
    try { f = await call('publicForm', { token }); } catch (e) { return fail(e.message); }
    if (f.submitted) return done('Təşəkkür edirik!', 'Bu qiymətləndirmə artıq təhvil verilib.');
    f.kind === 'sc' ? renderScorecard(f) : renderSatisfaction(f);
  }

  function renderScorecard(f) {
    const d = f.date ? f.date.split('-').reverse().join('.') : '';
    box.innerHTML = `<form id="evf" novalidate>
      <div class="ev-head"><h1 style="font-size:20px">Namizədin qiymətləndirilməsi</h1>
        <p class="muted" style="margin:6px 0 0">Hörmətli ${esc(f.evaluatorName)}, keçirilən müsahibə üzrə namizədi qiymətləndirməyinizi xahiş edirik.</p></div>
      <dl class="kv" style="margin-bottom:10px"><dt>Namizəd</dt><dd>${esc(f.candidate)}</dd><dt>Vakansiya</dt><dd>${esc(f.vacancy)} · ${esc(f.company)}</dd><dt>Müsahibə</dt><dd>${esc(d)} ${esc(f.time || '')}</dd></dl>
      <div class="info-box small">Hər meyar üzrə namizədi <b>vakansiyanın tələblərinə görə</b> qiymətləndirin, digər namizədlərlə müqayisəyə görə yox. Qiymətləriniz digər iştirakçılara onlar da təhvil verənə qədər göstərilmir.</div>
      ${f.criteria.map((c, i) => `<div class="scale-row"><b>${esc(c)} <span style="color:var(--bad)">*</span></b><div class="scale-opts">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="c${i}" value="${n}"><b>${n}</b>${esc((f.scale || {})[n] || '')}</label>`).join('')}</div></div>`).join('')}
      <div class="grid" style="gap:12px;margin-top:16px">
        <label class="f"><span>Ümumi tövsiyəniz <span style="color:var(--bad)">*</span></span><select name="recommendation"><option value="">Seçin…</option>${f.recommendations.map(r => `<option>${esc(r)}</option>`).join('')}</select></label>
        <label class="f"><span>Rəyiniz (istəyə bağlı)</span><textarea name="comment" rows="4" maxlength="3000" placeholder="Güclü və zəif tərəfləri, qeydləriniz…"></textarea></label>
        <div id="err"></div>
        <button class="btn btn-primary" type="submit" style="justify-content:center;padding:11px">Təhvil ver</button></div></form>`;
    const form = document.getElementById('evf');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const scores = {};
      const missing = [];
      f.criteria.forEach((c, i) => { const el = form.querySelector(`[name=c${i}]:checked`); if (el) scores[c] = +el.value; else missing.push(c); });
      const err = document.getElementById('err');
      if (missing.length) { err.innerHTML = `<div class="err-box">Bütün meyarları qiymətləndirin: ${esc(missing.join(', '))}</div>`; return; }
      if (!form.recommendation.value) { err.innerHTML = '<div class="err-box">Ümumi tövsiyənizi seçin.</div>'; return; }
      const btn = form.querySelector('button'); btn.disabled = true;
      try {
        await call('publicSubmit', { token, scores, recommendation: form.recommendation.value, comment: form.comment.value });
        done('Təşəkkür edirik!', 'Qiymətləndirməniz qeydə alındı. Bu səhifəni bağlaya bilərsiniz.');
      } catch (ex) { err.innerHTML = `<div class="err-box">${esc(ex.message)}</div>`; btn.disabled = false; }
    });
  }

  function renderSatisfaction(f) {
    const labels = { 1: 'Heç razı deyiləm', 2: 'Razı deyiləm', 3: 'Orta', 4: 'Razıyam', 5: 'Çox razıyam' };
    box.innerHTML = `<form id="evf" novalidate>
      <div class="ev-head"><h1 style="font-size:20px">Recruiter işinin qiymətləndirilməsi</h1>
        <p class="muted" style="margin:6px 0 0">Hörmətli ${esc(f.managerName)}, vakansiya bağlandı. Cəmi 1 sual.</p></div>
      <dl class="kv" style="margin-bottom:16px"><dt>Vakansiya</dt><dd>${esc(f.vacancy)} · ${esc(f.company)}</dd><dt>Recruiter</dt><dd>${esc(f.recruiter)}</dd></dl>
      <p style="font-weight:600">Bu vakansiya üzrə recruiterin işindən (sürət, namizədlərin uyğunluğu, ünsiyyət) nə dərəcədə razısınız? <span style="color:var(--bad)">*</span></p>
      <div class="stars">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="score" value="${n}"><b>${n}</b>${labels[n]}</label>`).join('')}</div>
      <div class="grid" style="gap:12px;margin-top:16px">
        <label class="f"><span>Təklif və qeydləriniz (istəyə bağlı)</span><textarea name="comment" rows="3" maxlength="3000"></textarea></label>
        <div id="err"></div>
        <button class="btn btn-primary" type="submit" style="justify-content:center;padding:11px">Göndər</button></div></form>`;
    const form = document.getElementById('evf');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const el = form.querySelector('[name=score]:checked');
      const err = document.getElementById('err');
      if (!el) { err.innerHTML = '<div class="err-box">1–5 arası qiymət seçin.</div>'; return; }
      const btn = form.querySelector('button'); btn.disabled = true;
      try { await call('publicSubmit', { token, score: +el.value, comment: form.comment.value }); done('Təşəkkür edirik!', 'Rəyiniz qeydə alındı.'); }
      catch (ex) { err.innerHTML = `<div class="err-box">${esc(ex.message)}</div>`; btn.disabled = false; }
    });
  }

  load();
})();
