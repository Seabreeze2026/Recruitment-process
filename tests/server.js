// Lokal sınaq serveri: statik faylları və Apps Script API simulyasiyasını işlədir.
// İstifadə: node tests/server.js  →  http://localhost:8080/?api=/api
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createEnv } = require('./gas-mock');

const ROOT = path.join(__dirname, '..');
const env = createEnv();
const { call, sandbox } = env;

// Nümunə məlumatlar
const out = sandbox.platformaQur();
const tmp = out.match(/Müvəqqəti parol: (\S+)/)[1];
let tok = call('login', { username: 'admin', password: tmp }).data.token;
call('changePassword', { oldPassword: tmp, newPassword: 'Admin2026' }, tok);
const users = [['sebnem', 'Rzayeva Şəbnəm Məhərrəm qızı'], ['nesibe', 'Məmmədova Nəsibə Elxan qızı'], ['emiliya', 'Abdulayeva Emiliya Abdulovna']];
const ids = {};
users.forEach(([u, n]) => {
  const r = call('saveUser', { username: u, fullName: n, role: 'recruiter' }, tok).data;
  ids[u] = r.bundle.users.find(x => x.username === u).id;
  const l = call('login', { username: u, password: r.tempPassword }).data;
  call('changePassword', { oldPassword: r.tempPassword, newPassword: 'Test2026' }, l.token);
});
if (process.env.SEED !== '0') {
  const t = sandbox.todayStr_();
  const ago = n => sandbox.addDays_(t, -n);
  const must = (r) => { if (!r.ok) throw new Error(r.error); return r.data; };
  const asUser = (u) => call('login', { username: u, password: 'Test2026' }).data.token;
  const s = asUser('sebnem');
  const v1 = must(call('saveVacancy', { title: 'Call-operatoru', company: 'NARDARAN INVEST MMC', department: 'Müştəri xidmətləri', hiringManager: 'Rüstəm Alışov', openedAt: ago(35), deadline: ago(5), salaryMin: 900, salaryMax: 1000, headcount: 2, difficulty: 'Asan' }, s)).id;
  const v2 = must(call('saveVacancy', { title: 'Backend developer', company: 'SeaBreeze Construction MMC', department: 'İT', hiringManager: 'Camal Babayev', openedAt: ago(20), deadline: sandbox.addDays_(t, 25), salaryMin: 2500, salaryMax: 3500, difficulty: 'Çətin', priority: 'Yüksək' }, s)).id;
  const cands = [['Sadıqzadə Yasəmən', '0501112233', 'LinkedIn', 1000], ['Əhmədova Zümrüd', '0702223344', 'Tövsiyə', 1000], ['Mollayeva Lamiyə', '0553334455', 'LinkedIn', 950], ['Axmerova Zarina', '0514445566', 'Jobsearch', 900], ['Həsənov Orxan', '0505556677', 'HeadHunt', 3200], ['Quliyev Tural', '0556667788', 'LinkedIn', 3000]];
  const c = cands.map(([n, p, src, sal]) => must(call('saveCandidate', { fullName: n, phone: p, source: src, salaryExpectation: sal }, s)).id);
  const a = [v1, v1, v1, v1, v2, v2].map((v, i) => must(call('addApplication', { vacancyId: v, candidateId: c[i] }, s)).id);
  const iv = (app, d, st, en, att, res, extra) => must(call('saveInterview', Object.assign({ applicationId: app, type: 'Panel müsahibə (qarışıq)', format: 'Oflayn', date: d, startTime: st, endTime: en, attendance: att, result: res, participantsManagers: 'Rüstəm Alışov' }, extra || {}), s)).id;
  const m1 = iv(a[0], ago(25), '14:00', '14:30', 'İştirak edib', 'Bəyənildi', { comment: 'Texniki sualları uğurla cavablandırdı.' });
  iv(a[1], ago(25), '14:30', '', 'İştirak etməyib', '', { absenceReason: 'Başqa iş tapdı' });
  const m3 = iv(a[2], ago(24), '15:00', '15:20', 'İştirak edib', 'Bəyənilmədi', { comment: 'Təcrübəsi kifayət deyil.' });
  iv(a[3], ago(2), '11:00', '');
  iv(a[4], sandbox.addDays_(t, 1), '10:00', '', '', '', { participantsManagers: 'Camal Babayev' });
  iv(a[5], t, '16:00', '', '', '', { participantsManagers: 'Camal Babayev' });
  const sc = { 'Peşəkar bilik': 4, 'Təcrübə': 4, 'Ünsiyyət bacarığı': 5, 'Motivasiya': 5, 'Komanda və mədəniyyət uyğunluğu': 4 };
  must(call('saveMyScorecard', { interviewId: m1, scores: sc, recommendation: 'Tövsiyə edirəm' }, s));
  const tk = must(call('createScorecardLink', { interviewId: m1, evaluatorName: 'Rüstəm Alışov' }, s)).token;
  must(call('publicSubmit', { token: tk, scores: sc, recommendation: 'Tövsiyə edirəm', comment: 'Uyğundur' }));
  must(call('saveMyScorecard', { interviewId: m3, scores: { 'Peşəkar bilik': 2, 'Təcrübə': 2, 'Ünsiyyət bacarığı': 3, 'Motivasiya': 3, 'Komanda və mədəniyyət uyğunluğu': 3 }, recommendation: 'Tövsiyə etmirəm' }, s));
  must(call('updateApplication', { id: a[2], stage: 'İmtina', fields: { rejectBy: 'Biz', rejectReason: 'Təcrübə kifayət deyil' } }, s));
  must(call('updateApplication', { id: a[1], stage: 'İmtina', fields: { rejectBy: 'Namizəd', rejectReason: 'Başqa təklifi qəbul etdi' } }, s));
  must(call('updateApplication', { id: a[0], stage: 'Təklif', fields: { offerDate: ago(22), offerSalary: 1000 } }, s));
  must(call('updateApplication', { id: a[0], stage: 'İşə qəbul', fields: { offerResponseDate: ago(20), hireDate: ago(15) } }, s));
  // Nəsibə üçün bağlanmış vakansiya
  const n = asUser('nesibe');
  const v3 = must(call('saveVacancy', { title: 'Resepsiyonist', company: 'BREEZE HOTEL MMC', department: 'Əməliyyatlar', hiringManager: 'Leyla Məmmədova', openedAt: ago(28), deadline: ago(3), salaryMin: 800, salaryMax: 900, difficulty: 'Orta' }, n)).id;
  const c7 = must(call('saveCandidate', { fullName: 'Kərimova Aysel', phone: '0517778899', source: 'Şəxsi müraciət', salaryExpectation: 850 }, n)).id;
  const c8 = must(call('saveCandidate', { fullName: 'Rəhimov Elvin', phone: '0518889900', source: 'Jobsearch', salaryExpectation: 900 }, n)).id;
  const a7 = must(call('addApplication', { vacancyId: v3, candidateId: c7 }, n)).id;
  const a8 = must(call('addApplication', { vacancyId: v3, candidateId: c8 }, n)).id;
  must(call('saveInterview', { applicationId: a7, type: 'İR əməkdaşları ilə', format: 'Onlayn', date: ago(18), startTime: '10:00', endTime: '10:25', attendance: 'İştirak edib', result: 'Bəyənildi' }, n));
  must(call('saveInterview', { applicationId: a8, type: 'İR əməkdaşları ilə', format: 'Onlayn', date: ago(18), startTime: '11:00', endTime: '11:20', attendance: 'İştirak edib', result: 'Qənaətbəxş' }, n));
  must(call('saveInterview', { applicationId: a8, type: 'Birbaşa struktur bölmə rəhbəri ilə', format: 'Oflayn', date: ago(15), startTime: '12:00', endTime: '12:30', attendance: 'İştirak edib', result: 'Bəyənildi' }, n));
  must(call('updateApplication', { id: a7, stage: 'Təklif', fields: { offerDate: ago(14), offerSalary: 850 } }, n));
  must(call('updateApplication', { id: a7, stage: 'İmtina', fields: { rejectBy: 'Namizəd', rejectReason: 'Ə/H uyğun gəlmədi' } }, n));
  must(call('updateApplication', { id: a8, stage: 'Təklif', fields: { offerDate: ago(12), offerSalary: 900 } }, n));
  must(call('updateApplication', { id: a8, stage: 'İşə qəbul', fields: { offerResponseDate: ago(10), hireDate: ago(7) } }, n));
  must(call('setVacancyStatus', { id: v3, status: 'Bağlandı' }, n));
  const st = must(call('createSatisfactionLink', { vacancyId: v3 }, n)).token;
  must(call('publicSubmit', { token: st, score: 4, comment: 'Yaxşı oldu' }));
  // gözləyən link (test üçün)
  const pend = must(call('createScorecardLink', { interviewId: m3, evaluatorName: 'Rüstəm Alışov' }, s)).token;
  fs.writeFileSync(path.join(__dirname, '.pending-token'), pend);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/api')) {
    let body = '';
    req.on('data', ch => { body += ch; });
    req.on('end', () => {
      const r = sandbox.doPost({ postData: { contents: body } });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(r.getContent());
    });
    return;
  }
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 8080, () => console.log('Hazır: http://localhost:' + (process.env.PORT || 8080) + '/?api=/api  (admin / Admin2026, sebnem / Test2026)'));
