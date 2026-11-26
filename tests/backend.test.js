// Arxa tərəfin avtomatik testi: node tests/backend.test.js
const assert = require('assert');
const { createEnv } = require('./gas-mock');

let passed = 0;
function ok(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}
function must(res) { if (!res.ok) throw new Error('Gözlənilməyən xəta: ' + res.error); return res.data; }
function fails(res, re) { assert.strictEqual(res.ok, false, 'Xəta gözlənilirdi'); if (re) assert.match(res.error, re); }

const env = createEnv();
const { call, sandbox } = env;
const today = sandbox.todayStr_();
const daysAgo = n => sandbox.addDays_(today, -n);

console.log('Quraşdırma və giriş');
let adminPw, adminToken, recToken, rec2Token, recId, rec2Id;
ok('platformaQur bazanı yaradır və admin açır', () => {
  const out = sandbox.platformaQur();
  adminPw = out.match(/Müvəqqəti parol: (\S+)/)[1];
  assert.ok(env.ss.getSheetByName('DB_Users'));
  assert.ok(adminPw.length === 10);
});
ok('səhv parol rədd edilir', () => fails(call('login', { username: 'admin', password: 'yanlis' }), /səhvdir/));
ok('admin daxil olur, parolu dəyişməyə məcburdur', () => {
  const d = must(call('login', { username: 'ADMIN', password: adminPw }));
  adminToken = d.token;
  assert.strictEqual(d.user.mustChange, true);
  fails(call('saveVacancy', { title: 'x' }, adminToken), /parolunuzu dəyişməlisiniz/);
});
ok('zəif parol qəbul edilmir', () => fails(call('changePassword', { oldPassword: adminPw, newPassword: 'abc' }, adminToken), /8 simvol/));
ok('parol dəyişir', () => { must(call('changePassword', { oldPassword: adminPw, newPassword: 'Admin2026x' }, adminToken)); });
ok('tokensiz sorğu rədd edilir', () => fails(call('loadAll', {}), /AUTH/));

console.log('İstifadəçilər');
ok('admin recruiter yaradır', () => {
  const d = must(call('saveUser', { username: 'sebnem.rzayeva', fullName: 'Rzayeva Şəbnəm Məhərrəm qızı', role: 'recruiter' }, adminToken));
  recId = d.bundle.users.find(u => u.username === 'sebnem.rzayeva').id;
  const l = must(call('login', { username: 'sebnem.rzayeva', password: d.tempPassword }));
  must(call('changePassword', { oldPassword: d.tempPassword, newPassword: 'Sebnem2026' }, l.token));
  recToken = l.token;
});
ok('ikinci recruiter', () => {
  const d = must(call('saveUser', { username: 'nesibe', fullName: 'Məmmədova Nəsibə Elxan qızı', role: 'recruiter' }, adminToken));
  rec2Id = d.bundle.users.find(u => u.username === 'nesibe').id;
  const l = must(call('login', { username: 'nesibe', password: d.tempPassword }));
  must(call('changePassword', { oldPassword: d.tempPassword, newPassword: 'Nesibe2026' }, l.token));
  rec2Token = l.token;
});
ok('dublikat istifadəçi adı rədd edilir', () => fails(call('saveUser', { username: 'nesibe', fullName: 'X' }, adminToken), /artıq mövcuddur/));
ok('recruiter istifadəçi yarada bilməz', () => fails(call('saveUser', { username: 'abc', fullName: 'X' }, recToken), /admin/));
ok('5 səhv cəhddən sonra bloklanır', () => {
  for (let i = 0; i < 5; i++) call('login', { username: 'nesibe', password: 'yanlis' + i });
  fails(call('login', { username: 'nesibe', password: 'Nesibe2026' }), /bloklanıb/);
});
ok('admin parolu sıfırlayanda blok açılır', () => {
  const d = must(call('resetPassword', { id: rec2Id }, adminToken));
  const l = must(call('login', { username: 'nesibe', password: d.tempPassword }));
  assert.strictEqual(l.user.mustChange, true);
  must(call('changePassword', { oldPassword: d.tempPassword, newPassword: 'Nesibe2027' }, l.token));
  rec2Token = l.token;
});

console.log('Vakansiya, namizəd, mərhələlər');
let vId, cId, aId, mId;
ok('validasiya: ə/h min > max', () => fails(call('saveVacancy', { title: 'Operator', company: 'NARDARAN INVEST MMC', openedAt: daysAgo(20), salaryMin: 1200, salaryMax: 900 }, recToken), /minimumu/));
ok('vakansiya yaradılır (recruiter özünə)', () => {
  const d = must(call('saveVacancy', { title: 'Call-operatoru', company: 'NARDARAN INVEST MMC', department: 'İT', hiringManager: 'Rüstəm Alışov', openedAt: daysAgo(20), deadline: sandbox.addDays_(today, 10), salaryMin: 900, salaryMax: 1000, headcount: 1, difficulty: 'Asan', recruiterId: rec2Id }, recToken));
  vId = d.id;
  const v = d.bundle.vacancies.find(x => x.id === vId);
  assert.strictEqual(v.recruiterId, recId, 'recruiter başqasına təyin edə bilməməlidir');
  assert.strictEqual(v.status, 'Açıq');
  assert.strictEqual(vId, 'V-0001');
});
ok('başqa recruiter vakansiyanı görmür və dəyişə bilmir', () => {
  const b = must(call('loadAll', {}, rec2Token));
  assert.strictEqual(b.vacancies.length, 0);
  fails(call('saveVacancy', { id: vId, title: 'Hack', company: 'X', openedAt: today }, rec2Token), /icazəniz yoxdur/);
});
ok('namizəd yaradılır', () => {
  const d = must(call('saveCandidate', { fullName: 'Sadıqzadə Yasəmən', phone: '+994 50 123 45 67', email: 'Yasemen@mail.az', source: 'LinkedIn', salaryExpectation: '1000' }, recToken));
  cId = d.id;
});
ok('dublikat telefon aşkarlanır', () => fails(call('saveCandidate', { fullName: 'Y. Sadıqzadə', phone: '050-123-45-67' }, rec2Token), /^DUPLICATE:N-0001/));
ok('dublikat email aşkarlanır', () => fails(call('saveCandidate', { fullName: 'Başqa', email: 'yasemen@mail.az' }, recToken), /DUPLICATE/));
ok('formula inyeksiyası təmizlənir', () => {
  const d = must(call('saveCandidate', { fullName: '=HYPERLINK("x")', phone: '0559998877' }, recToken));
  const raw = env.ss.getSheetByName('DB_Candidates')._data().find(r => r[0] === d.id);
  assert.ok(raw[1].startsWith("'="));
});
ok('namizəd vakansiyaya əlavə olunur', () => {
  const d = must(call('addApplication', { vacancyId: vId, candidateId: cId }, recToken));
  aId = d.id;
  fails(call('addApplication', { vacancyId: vId, candidateId: cId }, recToken), /artıq/);
});

console.log('Müsahibə və qiymətləndirmə');
ok('gələcək müsahibəyə iştirak statusu yazıla bilməz', () => fails(call('saveInterview', { applicationId: aId, date: sandbox.addDays_(today, 3), startTime: '14:00', attendance: 'İştirak edib', endTime: '14:30', result: 'Bəyənildi' }, recToken), /Gələcək/));
ok('iştirak edibsə nəticə tələb olunur', () => fails(call('saveInterview', { applicationId: aId, date: daysAgo(10), startTime: '14:00', endTime: '14:30', attendance: 'İştirak edib' }, recToken), /nəticəni/));
ok('müsahibə yaradılır, namizəd avtomatik "Müsahibə" mərhələsinə keçir', () => {
  const d = must(call('saveInterview', { applicationId: aId, type: 'Panel müsahibə (qarışıq)', format: 'Oflayn', date: daysAgo(10), startTime: '14:00', endTime: '14:40', attendance: 'İştirak edib', result: 'Bəyənildi', comment: 'Yaxşı' }, recToken));
  mId = d.id;
  assert.strictEqual(d.bundle.applications.find(a => a.id === aId).stage, 'Müsahibə');
});
let token;
ok('rəhbər üçün link yaradılır', () => {
  const d = must(call('createScorecardLink', { interviewId: mId, evaluatorName: 'Rüstəm Alışov' }, recToken));
  token = d.token; assert.ok(token.length >= 32);
});
ok('recruiter öz kartını doldurur', () => {
  fails(call('saveMyScorecard', { interviewId: mId, scores: { 'Peşəkar bilik': 4 } , recommendation: 'Tövsiyə edirəm' }, recToken), /meyarı/);
  const scores = { 'Peşəkar bilik': 4, 'Təcrübə': 4, 'Ünsiyyət bacarığı': 5, 'Motivasiya': 4, 'Komanda və mədəniyyət uyğunluğu': 3 };
  must(call('saveMyScorecard', { interviewId: mId, scores, recommendation: 'Tövsiyə edirəm' }, recToken));
});
ok('link açılır, namizəd və meyarlar görünür', () => {
  const f = must(call('publicForm', { token }));
  assert.strictEqual(f.kind, 'sc'); assert.strictEqual(f.candidate, 'Sadıqzadə Yasəmən'); assert.strictEqual(f.criteria.length, 5);
});
ok('səhv token rədd edilir', () => fails(call('publicForm', { token: 'x'.repeat(40) }), /etibarsız/));
ok('rəhbər linklə qiymət verir', () => {
  const scores = { 'Peşəkar bilik': 5, 'Təcrübə': 4, 'Ünsiyyət bacarığı': 4, 'Motivasiya': 5, 'Komanda və mədəniyyət uyğunluğu': 4 };
  must(call('publicSubmit', { token, scores, recommendation: 'Tövsiyə edirəm', comment: 'Uyğundur' }));
  fails(call('publicSubmit', { token, scores, recommendation: 'Tövsiyə edirəm' }), /artıq/);
  assert.strictEqual(must(call('publicForm', { token })).submitted, true);
});
ok('kor qiymətləndirmə: gözləyən link varsa digər ballar gizlidir', () => {
  must(call('createScorecardLink', { interviewId: mId, evaluatorName: 'Camal Babayev' }, recToken));
  const b = must(call('loadAll', {}, recToken));
  const mgr = b.scorecards.find(s => s.evaluatorName === 'Rüstəm Alışov');
  assert.strictEqual(mgr.hidden, true); assert.strictEqual(mgr.average, '');
  const mine = b.scorecards.find(s => s.userId === recId);
  assert.strictEqual(mine.average, '4');
  const a = must(call('loadAll', {}, adminToken));
  assert.strictEqual(a.scorecards.find(s => s.evaluatorName === 'Rüstəm Alışov').average, '4.4');
});
ok('gözləyən link ləğv edilir, ballar görünür', () => {
  const b = must(call('loadAll', {}, recToken));
  const pend = b.scorecards.find(s => s.evaluatorName === 'Camal Babayev');
  const after = must(call('cancelLink', { id: pend.id, kind: 'sc' }, recToken)).bundle;
  assert.strictEqual(after.scorecards.find(s => s.evaluatorName === 'Rüstəm Alışov').average, '4.4');
});

console.log('Təklif, işə qəbul, bağlanma');
ok('təklif mərhələsi tarix və məbləğ tələb edir', () => fails(call('updateApplication', { id: aId, stage: 'Təklif' }, recToken), /Təklif tarixini/));
ok('təklif mərhələsinə keçid', () => must(call('updateApplication', { id: aId, stage: 'Təklif', fields: { offerDate: daysAgo(8), offerSalary: 1000, offerResponse: 'Gözlənilir' } }, recToken)));
ok('işə qəbul — vakansiya doldu xəbərdarlığı', () => {
  const d = must(call('updateApplication', { id: aId, stage: 'İşə qəbul', fields: { offerResponse: 'Qəbul etdi', offerResponseDate: daysAgo(7), hireDate: daysAgo(5) } }, recToken));
  assert.strictEqual(d.vacancyFilled, true);
  const a = d.bundle.applications.find(x => x.id === aId);
  assert.strictEqual(a.probationEnd, sandbox.addMonths_(daysAgo(5), 3));
  assert.strictEqual(JSON.parse(a.stageHistory).length, 4);
});
ok('bitmiş prosesi recruiter birbaşa dəyişə bilmir', () => fails(call('updateApplication', { id: aId, stage: 'Final' }, recToken), /prosesi bitib/));
ok('vakansiya bağlanır', () => must(call('setVacancyStatus', { id: vId, status: 'Bağlandı' }, recToken)));
let satToken;
ok('məmnuniyyət linki və cavab', () => {
  satToken = must(call('createSatisfactionLink', { vacancyId: vId }, recToken)).token;
  const f = must(call('publicForm', { token: satToken }));
  assert.strictEqual(f.kind, 'sat'); assert.strictEqual(f.recruiter, 'Rzayeva Şəbnəm Məhərrəm qızı');
  fails(call('publicSubmit', { token: satToken, score: 9 }), /1–5/);
  must(call('publicSubmit', { token: satToken, score: 5, comment: 'Sürətli oldu' }));
});

console.log('Təklifdən imtina, gəlməmə və dayandırma');
let v2;
ok('ikinci vakansiya: dayandırılan günlər hesablanır', () => {
  v2 = must(call('saveVacancy', { title: 'Mühasib', company: 'BREEZE HOTEL MMC', openedAt: daysAgo(40), deadline: daysAgo(2), difficulty: 'Orta' }, recToken)).id;
  // pauza: 10 gün əvvəl dayandırılıb, bu gün açılıb
  must(call('setVacancyStatus', { id: v2, status: 'Dayandırılıb', date: daysAgo(10) }, recToken));
  const b = must(call('setVacancyStatus', { id: v2, status: 'Açıq' }, recToken)).bundle;
  assert.strictEqual(b.vacancies.find(v => v.id === v2).pausedDays, '10');
});
ok('təklif mərhələsində namizəd imtina edir → təklifdən imtina', () => {
  const c = must(call('saveCandidate', { fullName: 'Əhmədova Zümrüd', phone: '0701112233', source: 'Tövsiyə' }, recToken)).id;
  const a = must(call('addApplication', { vacancyId: v2, candidateId: c }, recToken)).id;
  must(call('updateApplication', { id: a, stage: 'Təklif', fields: { offerDate: daysAgo(3), offerSalary: 1500 } }, recToken));
  fails(call('updateApplication', { id: a, stage: 'İmtina', fields: { rejectBy: 'Namizəd' } }, recToken), /səbəbini/);
  const b = must(call('updateApplication', { id: a, stage: 'İmtina', fields: { rejectBy: 'Namizəd', rejectReason: 'Ə/H uyğun gəlmədi' } }, recToken)).bundle;
  const app = b.applications.find(x => x.id === a);
  assert.strictEqual(app.offerResponse, 'İmtina etdi'); assert.strictEqual(app.offerDeclineReason, 'Ə/H uyğun gəlmədi');
});
ok('gəlməyən namizəd: səbəb tələb olunur', () => {
  const c = must(call('saveCandidate', { fullName: 'Mollayeva Lamiyə', phone: '0517778899', source: 'LinkedIn' }, recToken)).id;
  const a = must(call('addApplication', { vacancyId: v2, candidateId: c }, recToken)).id;
  fails(call('saveInterview', { applicationId: a, date: daysAgo(4), startTime: '11:00', attendance: 'İştirak etməyib' }, recToken), /səbəbini/);
  must(call('saveInterview', { applicationId: a, date: daysAgo(4), startTime: '11:00', attendance: 'İştirak etməyib', absenceReason: 'Başqa iş tapdı' }, recToken));
  must(call('saveInterview', { applicationId: a, date: daysAgo(1), startTime: '11:00' }, recToken)); // nəticəsi daxil edilməyib
});

console.log('Performans');
let perf;
ok('performans hesablanır', () => {
  perf = must(call('performance', { from: daysAgo(30), to: today }, adminToken));
  const r = perf.rows.find(x => x.recruiterId === recId);
  const m = r.metrics;
  assert.strictEqual(m.P1.value, 100);           // vaxtında bağlanıb
  assert.strictEqual(m.P2.value, 13);            // 20 gün əvvəl açılıb, 7 gün əvvəl təklif qəbul olunub
  assert.strictEqual(m.P2.score, 100);
  assert.strictEqual(m.P3.value, 50);            // 1 qəbul, 1 imtina
  assert.strictEqual(m.P3.score, 66.7);
  assert.strictEqual(m.P4.n, 0);                 // sınaq hələ bitməyib
  assert.strictEqual(m.P5.value, 5);
  assert.strictEqual(m.P6.value, 50);            // 2 müsahibədən 1 gəlməyib
  assert.strictEqual(m.P6.score, 20);
  assert.strictEqual(r.info.interviews, 3);
  assert.strictEqual(r.info.hires, 1);
  assert.strictEqual(r.enough, true);
  assert.ok(r.total > 0 && r.total <= 100);
  assert.strictEqual(r.trend.length, 6);
});
ok('işi olmayan recruiter bal almır', () => {
  const r = perf.rows.find(x => x.recruiterId === rec2Id);
  assert.strictEqual(r.total, null); assert.strictEqual(r.enough, false);
});
ok('recruiter yalnız özünü görür', () => {
  const p = must(call('performance', { from: daysAgo(30), to: today }, recToken));
  assert.deepStrictEqual(p.rows.map(r => r.recruiterId), [recId]);
});
ok('parametrlər (çəkilər) dəyişir və tətbiq olunur', () => {
  must(call('saveSettings', { weights: { P1: 100, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0, P7: 0, P8: 0 } }, adminToken));
  const p = must(call('performance', { from: daysAgo(30), to: today }, adminToken));
  assert.strictEqual(p.rows.find(x => x.recruiterId === recId).total, 100);
  fails(call('saveSettings', { weights: {} }, recToken), /admin/);
  must(call('saveSettings', { weights: { P1: 20, P2: 15, P3: 15, P4: 15, P5: 10, P6: 10, P7: 10, P8: 5 } }, adminToken));
});
ok('audit jurnalı yazılır', () => {
  const log = must(call('auditLog', {}, adminToken));
  assert.ok(log.length > 20);
  assert.ok(log.some(l => l.action === 'Qiymətləndirmə linklə təhvil verildi'));
});

console.log('Köhnə məlumatların köçürülməsi');
ok('köhnə vərəqlərdən köçürmə', () => {
  const e2 = createEnv();
  e2.sandbox.platformaQur();
  const vs = e2.ss.insertSheet('Vakansiyalar bazası');
  vs.getRange(1, 1, 2, 10).setValues([
    ['S/S', 'Şirkət', 'Bölmə', 'Şəxs', 'İR', 'Vakansiya', 'Ə/H', 'Son tarix', 'Rəy', 'Qeydiyyat'],
    [1, 'NARDARAN INVEST MMC', 'İT Departamenti', 'Rüstəm Alışov', 'Rzayeva Şəbnəm Məhərrəm qızı', 'Call-operatoru və rezidentlərlə iş üzrə operator', '1000 AZN (NET)', '', '', '16.09.26']]);
  const ms = e2.ss.insertSheet('Müsahibələr bazası');
  const row = (n, name, att, endT, res, status, hire, date) => [n, 'NARDARAN INVEST MMC', 'Panel müsahibə (qarışıq)', 'Rzayeva Şəbnəm Məhərrəm qızı', 'Rüstəm Alışov; Camal Babayev', 'Call-operatoru və rezidentlərlə iş üzrə operator', '1000 AZN (NET)', '900-1000 AZN', name, 'Yoxdur', '', date, '14:00', 'LinkedIn', '', att, '', 'Oflayn', endT, 'rəy', res, '17.09.26', status, hire];
  ms.getRange(1, 1, 4, 24).setValues([new Array(24).fill('h'),
    row(1, 'Sadıqzadə Yasəmən', 'İştirak edib', '14:15', 'Bəyənildi', 'İşə qəbul edildi', '03.08.26', '20.07.26'),
    row(2, 'Əhmədova Zümrüd', 'İştirak etməyib', '', '', 'Uyğun görülmədi', '', '20.07.26'),
    row(3, 'Axmerova Zarina', 'İştirak edib', '14:45', 'Bəyənilmədi', 'Uyğun görülmədi', '', '20.08.26')]);
  const out = e2.sandbox.kohneMelumatlariKocur();
  assert.match(out, /Köçürmə tamamlandı/);
  e2.sandbox.resetCache_();
  const T = e2.sandbox.T_;
  assert.strictEqual(T('Vacancies').all().length, 1);
  assert.strictEqual(T('Vacancies').all()[0].salaryMax, '1000');
  assert.strictEqual(T('Candidates').all().length, 3);
  assert.strictEqual(T('Interviews').all().length, 3);
  const apps = T('Applications').all();
  assert.strictEqual(apps.find(a => a.stage === 'İşə qəbul').hireDate, '2026-08-03');
  assert.strictEqual(apps.filter(a => a.stage === 'İmtina').length, 2);
  assert.ok(T('Users').all().some(u => u.fullName === 'Rzayeva Şəbnəm Məhərrəm qızı'));
});

console.log(`\n${passed} test keçdi${process.exitCode ? ', xətalar var' : ', hamısı uğurlu'}.`);
