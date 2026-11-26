/**
 * İŞƏ QƏBUL PLATFORMASI — Google Apps Script API
 * ------------------------------------------------
 * Bu fayl Google Sheet-ə bağlı Apps Script layihəsinə əlavə olunur.
 * Web interfeys (GitHub Pages) bu API-yə POST sorğuları göndərir.
 *
 * İlk quraşdırma: redaktorda `platformaQur` funksiyasını bir dəfə işə salın.
 * Köhnə məlumatları köçürmək üçün: `kohneMelumatlariKocur` funksiyası.
 */

var APP = {
  SESSION_SECONDS: 6 * 60 * 60, // 6 saat
  LOCK_AFTER: 5,                // neçə səhv cəhddən sonra bloklansın
  LOCK_MINUTES: 15,
  HASH_ROUNDS: 300,
  LINK_DAYS: 30,                // rəhbər linkinin etibarlılıq müddəti
  PREFIX: 'DB_'
};

var SCHEMA = {
  Users: ['id', 'username', 'fullName', 'role', 'salt', 'hash', 'active', 'mustChange', 'failedCount', 'lockedUntil', 'createdAt'],
  Vacancies: ['id', 'company', 'department', 'hiringManager', 'recruiterId', 'title', 'headcount', 'salaryMin', 'salaryMax', 'difficulty', 'priority', 'minScore', 'openedAt', 'deadline', 'status', 'pausedSince', 'pausedDays', 'closedAt', 'note', 'createdAt', 'createdBy', 'updatedAt'],
  Candidates: ['id', 'fullName', 'phone', 'email', 'cvUrl', 'source', 'sourceNote', 'salaryExpectation', 'note', 'createdAt', 'createdBy'],
  Applications: ['id', 'vacancyId', 'candidateId', 'recruiterId', 'stage', 'stageChangedAt', 'stageHistory', 'rejectBy', 'rejectReason', 'offerDate', 'offerSalary', 'offerResponse', 'offerResponseDate', 'offerDeclineReason', 'hireDate', 'probationEnd', 'probationResult', 'probationNote', 'createdAt', 'updatedAt'],
  Interviews: ['id', 'applicationId', 'vacancyId', 'candidateId', 'recruiterId', 'type', 'format', 'date', 'startTime', 'endTime', 'participantsHR', 'participantsManagers', 'taskType', 'taskResult', 'attendance', 'absenceReason', 'comment', 'result', 'createdAt', 'resultEnteredAt', 'createdBy'],
  Scorecards: ['id', 'interviewId', 'evaluatorName', 'evaluatorRole', 'userId', 'token', 'status', 'scores', 'average', 'recommendation', 'comment', 'submittedAt', 'createdAt'],
  Satisfaction: ['id', 'vacancyId', 'recruiterId', 'managerName', 'token', 'status', 'score', 'comment', 'submittedAt', 'createdAt'],
  Settings: ['key', 'value'],
  Audit: ['ts', 'userId', 'userName', 'action', 'entity', 'entityId', 'details']
};

var ID_PREFIX = { Vacancies: 'V', Candidates: 'N', Applications: 'A', Interviews: 'M', Scorecards: 'Q', Satisfaction: 'R', Users: 'U' };

var STAGES = ['Müraciət', 'İlkin söhbət', 'Müsahibə', 'Tapşırıq', 'Final', 'Təklif', 'İşə qəbul', 'İmtina'];
var VACANCY_STATUSES = ['Açıq', 'Dayandırılıb', 'Bağlandı', 'Ləğv edildi'];
var SUBMITTED = 'Təhvil verildi';
var PENDING = 'Gözlənilir';

function defaultSettings_() {
  return {
    companies: ['NARDARAN INVEST MMC', 'SeaBreeze Construction MMC', 'BREEZE HOTEL MMC', 'CROCUS FITNESS MMC', 'SEA BREEZE DESIGN MMC', 'SEA BREEZE GLAMP MMC', 'SEA BREEZE NİNE SENSES MMC', 'SEA BREEZE OKİDS MMC', 'SEAYA MMC', 'T-Service MMC', 'AZCERT MMC', 'CROCUS TRADING MMC', 'DREAM GROUP İNT MMC', 'HALFMOON PROJECT MMC', 'NARDARAN BEACH RESORT MMC', 'SEA BREEZE DELİVERY MMC', 'SEA BREEZE HEALTH VALLEY MMC', 'Sea Breeze Marinas MMC', 'VINE STORE AND BAR MMC', 'SEA BREEZE UZBEKISTAN', 'NİKKİ BEACH', 'AGALAROV DEVELOPMENT'],
    departments: ['İT', 'Maliyyə', 'İnsan resursları', 'Satış', 'Marketinq', 'Əməliyyatlar', 'Hüquq', 'Satınalma', 'Müştəri xidmətləri', 'Digər'],
    interviewTypes: ['İR əməkdaşları ilə', 'Panel müsahibə (qarışıq)', 'Birbaşa struktur bölmə rəhbəri ilə'],
    formats: ['Oflayn', 'Onlayn'],
    taskTypes: ['Yoxdur', 'Texniki tapşırıq', 'Keys tipli tapşırıq', 'Test'],
    sources: ['Şəxsi müraciət', 'Tövsiyə', 'LinkedIn', 'Jobsearch', 'Daxili müraciət', 'HeadHunt', 'Digər'],
    interviewResults: ['Bəyənildi', 'Qənaətbəxş', 'Bəyənilmədi'],
    absenceReasons: ['Xəbərdarlıq etmədən gəlmədi', 'Başqa iş tapdı', 'Vaxt uyğun gəlmədi', 'Fikrini dəyişdi', 'Digər'],
    rejectReasonsUs: ['Peşəkar bilik kifayət deyil', 'Təcrübə kifayət deyil', 'Ə/H gözləntisi yüksəkdir', 'Ünsiyyət / motivasiya zəifdir', 'Müsahibəyə gəlmədi', 'Digər'],
    rejectReasonsCandidate: ['Ə/H uyğun gəlmədi', 'Başqa təklifi qəbul etdi', 'İş qrafiki / şərait uyğun gəlmədi', 'Məkan uzaqdır', 'Əlaqə saxlamadı', 'Digər'],
    criteria: ['Peşəkar bilik', 'Təcrübə', 'Ünsiyyət bacarığı', 'Motivasiya', 'Komanda və mədəniyyət uyğunluğu'],
    scale: { '1': 'Tələbə cavab vermir', '2': 'Qismən cavab verir', '3': 'Tələbə cavab verir', '4': 'Tələbdən yüksəkdir', '5': 'Mükəmməldir' },
    defaultMinScore: 3,
    targetDays: { 'Asan': 20, 'Orta': 30, 'Çətin': 45 },
    probationMonths: 3,
    timelyEntryDays: 1,
    minInterviews: 3,
    weights: { P1: 20, P2: 15, P3: 15, P4: 15, P5: 10, P6: 10, P7: 10, P8: 5 },
    targets: { P1: 90, P3: 75, P4: 90, P5: 4.5, P6: 10, P7: 95, P8: 90 }
  };
}

/* ======================= HTTP GİRİŞ NÖQTƏLƏRİ ======================= */

function doGet() {
  return json_({ ok: true, data: { service: 'recruitment-process', time: nowIso_() } });
}

function doPost(e) {
  var res;
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    res = { ok: true, data: route_(req) };
  } catch (err) {
    res = { ok: false, error: (err && err.message) ? err.message : String(err) };
  }
  return json_(res);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

var PUBLIC_ACTIONS = {
  ping: function () { return { time: nowIso_() }; },
  login: login_,
  publicForm: publicForm_,
  publicSubmit: publicSubmit_
};

var READ_ACTIONS = {
  loadAll: function (ctx) { return bundle_(ctx); },
  performance: performanceAction_,
  me: function (ctx) { return publicUser_(ctx.user); },
  logout: logout_,
  auditLog: auditLog_
};

var WRITE_ACTIONS = {
  changePassword: changePassword_,
  saveVacancy: saveVacancy_,
  setVacancyStatus: setVacancyStatus_,
  saveCandidate: saveCandidate_,
  addApplication: addApplication_,
  updateApplication: updateApplication_,
  saveInterview: saveInterview_,
  deleteInterview: deleteInterview_,
  saveMyScorecard: saveMyScorecard_,
  createScorecardLink: createScorecardLink_,
  createSatisfactionLink: createSatisfactionLink_,
  cancelLink: cancelLink_,
  saveUser: saveUser_,
  resetPassword: resetPassword_,
  saveSettings: saveSettings_
};

function route_(req) {
  var action = String(req.action || '');
  var data = req.data || {};
  if (PUBLIC_ACTIONS[action]) {
    return withLockIf_(action === 'login' || action === 'publicSubmit', function () {
      return PUBLIC_ACTIONS[action](data);
    });
  }
  var ctx = auth_(req.token);
  ctx.token = req.token;
  if (READ_ACTIONS[action]) return READ_ACTIONS[action](ctx, data);
  if (WRITE_ACTIONS[action]) {
    if (ctx.user.mustChange === 'true' && action !== 'changePassword') {
      throw new Error('Əvvəlcə parolunuzu dəyişməlisiniz.');
    }
    return withLockIf_(true, function () {
      resetCache_();
      ctx.user = T_('Users').get(ctx.user.id); // təzə məlumat
      var out = WRITE_ACTIONS[action](ctx, data);
      return out === undefined ? { bundle: bundle_(ctx) } : out;
    });
  }
  throw new Error('Naməlum əməliyyat: ' + action);
}

function withLockIf_(needLock, fn) {
  if (!needLock) return fn();
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ======================= CƏDVƏL QATI ======================= */

var _tables = {};
function resetCache_() { _tables = {}; }

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var sh = ss_().getSheetByName(APP.PREFIX + name);
  if (!sh) throw new Error('Baza vərəqi tapılmadı: ' + APP.PREFIX + name + '. Əvvəlcə "platformaQur" funksiyasını işə salın.');
  return sh;
}

function cellToString_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v);
}

function safeCell_(v) {
  if (v === null || v === undefined) return '';
  var s = String(v);
  if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; // formula inyeksiyasının qarşısı
  return s;
}

function T_(name) {
  if (_tables[name]) return _tables[name];
  var cols = SCHEMA[name];
  var sh = sheet_(name);
  var last = sh.getLastRow();
  var rows = [];
  if (last > 1) {
    var values = sh.getRange(2, 1, last - 1, cols.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var o = { _row: i + 2 };
      for (var j = 0; j < cols.length; j++) o[cols[j]] = cellToString_(values[i][j]);
      if (o[cols[0]] !== '') rows.push(o);
    }
  }
  var t = {
    name: name,
    rows: rows,
    all: function () { return rows; },
    get: function (id) {
      for (var k = 0; k < rows.length; k++) if (rows[k][cols[0]] === String(id)) return rows[k];
      return null;
    },
    find: function (fn) { for (var k = 0; k < rows.length; k++) if (fn(rows[k])) return rows[k]; return null; },
    filter: function (fn) { return rows.filter(fn); },
    nextId: function () {
      var p = ID_PREFIX[name] || 'X', max = 0;
      rows.forEach(function (r) {
        var m = String(r.id).match(/(\d+)$/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      });
      return p + '-' + ('0000' + (max + 1)).slice(-Math.max(4, String(max + 1).length));
    },
    insert: function (obj) {
      var rowVals = cols.map(function (c) { return safeCell_(obj[c]); });
      sh.appendRow(rowVals);
      var o = { _row: sh.getLastRow() };
      cols.forEach(function (c, idx) { o[c] = String(obj[c] === undefined || obj[c] === null ? '' : obj[c]); });
      rows.push(o);
      return o;
    },
    update: function (id, patch) {
      var r = t.get(id);
      if (!r) throw new Error('Qeyd tapılmadı: ' + id);
      Object.keys(patch).forEach(function (k) {
        if (cols.indexOf(k) >= 0 && k !== cols[0]) r[k] = patch[k] === undefined || patch[k] === null ? '' : String(patch[k]);
      });
      sh.getRange(r._row, 1, 1, cols.length).setValues([cols.map(function (c) { return safeCell_(r[c]); })]);
      return r;
    },
    remove: function (id) {
      var r = t.get(id);
      if (!r) return;
      sh.deleteRow(r._row);
      resetCache_();
    }
  };
  _tables[name] = t;
  return t;
}

function strip_(row) {
  if (!row) return row;
  var o = {};
  Object.keys(row).forEach(function (k) { if (k !== '_row') o[k] = row[k]; });
  return o;
}

/* ======================= TƏNZİMLƏMƏLƏR ======================= */

function getSettings_() {
  var s = defaultSettings_();
  T_('Settings').all().forEach(function (r) {
    try { s[r.key] = JSON.parse(r.value); } catch (e) { /* keçərsiz dəyər — default qalır */ }
  });
  return s;
}

function saveSettings_(ctx, data) {
  requireAdmin_(ctx);
  var allowed = Object.keys(defaultSettings_());
  var t = T_('Settings');
  Object.keys(data || {}).forEach(function (k) {
    if (allowed.indexOf(k) < 0) return;
    var val = JSON.stringify(data[k]);
    var row = t.get(k);
    if (row) t.update(k, { value: val }); else t.insert({ key: k, value: val });
  });
  audit_(ctx, 'Parametrlər dəyişdi', 'Settings', '', Object.keys(data || {}).join(', '));
}

/* ======================= TARİX KÖMƏKÇİLƏRİ ======================= */

function nowIso_() { return new Date().toISOString(); }
function todayStr_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function tz_() { try { return Session.getScriptTimeZone() || 'Asia/Baku'; } catch (e) { return 'Asia/Baku'; } }
function isDate_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function toDay_(s) {
  // ISO tarix və ya timestamp-dan yerli günü çıxarır
  if (!s) return '';
  s = String(s);
  if (isDate_(s)) return s;
  var d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
}
function daysBetween_(a, b) {
  if (!isDate_(a) || !isDate_(b)) return null;
  var da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  var db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((db - da) / 86400000);
}
function addDays_(a, n) {
  var d = new Date(Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) + n * 86400000);
  return d.toISOString().slice(0, 10);
}
function addMonths_(a, n) {
  var y = +a.slice(0, 4), m = +a.slice(5, 7) - 1 + n, d = +a.slice(8, 10);
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + Math.min(d, last)).slice(-2);
}
function inRange_(d, from, to) { return isDate_(d) && d >= from && d <= to; }
function minutesOf_(t) {
  var m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}
function num_(v) { var n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; }

/* ======================= AUTENTİFİKASİYA ======================= */

function bytesToHex_(bytes) {
  return bytes.map(function (b) { var v = b < 0 ? b + 256 : b; return ('0' + v.toString(16)).slice(-2); }).join('');
}

function hash_(password, salt) {
  var h = salt + '|' + password;
  for (var i = 0; i < APP.HASH_ROUNDS; i++) {
    h = bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  }
  return h;
}

function newSalt_() { return Utilities.getUuid().replace(/-/g, ''); }

function randomPassword_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  var raw = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var out = '';
  for (var i = 0; i < 10; i++) out += chars[parseInt(raw.substr(i * 2, 2), 16) % chars.length];
  return out;
}

function validatePassword_(pw) {
  pw = String(pw || '');
  if (pw.length < 8) throw new Error('Parol ən azı 8 simvol olmalıdır.');
  if (!/[0-9]/.test(pw) || !/[A-Za-zƏəÖöÜüĞğİıŞşÇç]/.test(pw)) throw new Error('Parolda həm hərf, həm rəqəm olmalıdır.');
}

function login_(data) {
  resetCache_();
  var username = String(data.username || '').trim().toLowerCase();
  var password = String(data.password || '');
  var t = T_('Users');
  var u = t.find(function (r) { return r.username.toLowerCase() === username; });
  var generic = 'İstifadəçi adı və ya parol səhvdir.';
  if (!u || u.active !== 'true') throw new Error(generic);
  if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) {
    throw new Error('Çox sayda səhv cəhd. Hesab ' + APP.LOCK_MINUTES + ' dəqiqəlik bloklanıb.');
  }
  if (hash_(password, u.salt) !== u.hash) {
    var fc = (parseInt(u.failedCount, 10) || 0) + 1;
    var patch = { failedCount: fc };
    if (fc >= APP.LOCK_AFTER) {
      patch.failedCount = 0;
      patch.lockedUntil = new Date(Date.now() + APP.LOCK_MINUTES * 60000).toISOString();
    }
    t.update(u.id, patch);
    throw new Error(generic);
  }
  t.update(u.id, { failedCount: 0, lockedUntil: '' });
  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('s_' + token, u.id, APP.SESSION_SECONDS);
  audit_({ user: u }, 'Sistemə giriş', 'Users', u.id, '');
  return { token: token, user: publicUser_(u) };
}

function auth_(token) {
  if (!token) throw new Error('AUTH: Sessiya bitib, yenidən daxil olun.');
  var cache = CacheService.getScriptCache();
  var uid = cache.get('s_' + token);
  if (!uid) throw new Error('AUTH: Sessiya bitib, yenidən daxil olun.');
  var u = T_('Users').get(uid);
  if (!u || u.active !== 'true') throw new Error('AUTH: Hesab deaktivdir.');
  cache.put('s_' + token, uid, APP.SESSION_SECONDS); // sessiyanı uzat
  return { user: u };
}

function logout_(ctx) {
  CacheService.getScriptCache().remove('s_' + ctx.token);
  return { ok: true };
}

function publicUser_(u) {
  return { id: u.id, username: u.username, fullName: u.fullName, role: u.role, active: u.active === 'true', mustChange: u.mustChange === 'true' };
}

function isAdmin_(ctx) { return ctx.user && ctx.user.role === 'admin'; }
function requireAdmin_(ctx) { if (!isAdmin_(ctx)) throw new Error('Bu əməliyyat yalnız admin üçündür.'); }

function changePassword_(ctx, data) {
  var u = ctx.user;
  if (hash_(String(data.oldPassword || ''), u.salt) !== u.hash) throw new Error('Cari parol səhvdir.');
  validatePassword_(data.newPassword);
  var salt = newSalt_();
  T_('Users').update(u.id, { salt: salt, hash: hash_(data.newPassword, salt), mustChange: 'false' });
  audit_(ctx, 'Parol dəyişdi', 'Users', u.id, '');
  ctx.user = T_('Users').get(u.id);
}

function saveUser_(ctx, data) {
  requireAdmin_(ctx);
  var t = T_('Users');
  var username = String(data.username || '').trim().toLowerCase();
  var fullName = String(data.fullName || '').trim();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('İstifadəçi adı 3–30 simvol, yalnız latın hərfi, rəqəm, nöqtə, tire ola bilər.');
  if (!fullName) throw new Error('Ad, soyad daxil edin.');
  var role = data.role === 'admin' ? 'admin' : 'recruiter';
  var dup = t.find(function (r) { return r.username.toLowerCase() === username && r.id !== data.id; });
  if (dup) throw new Error('Bu istifadəçi adı artıq mövcuddur.');
  if (data.id) {
    if (data.id === ctx.user.id && (role !== 'admin' || data.active === false)) throw new Error('Öz admin hüququnuzu və ya hesabınızı deaktiv edə bilməzsiniz.');
    t.update(data.id, { username: username, fullName: fullName, role: role, active: data.active === false ? 'false' : 'true' });
    audit_(ctx, 'İstifadəçi dəyişdi', 'Users', data.id, fullName);
    return { bundle: bundle_(ctx) };
  }
  var pw = randomPassword_();
  var salt = newSalt_();
  var id = t.nextId();
  t.insert({ id: id, username: username, fullName: fullName, role: role, salt: salt, hash: hash_(pw, salt), active: 'true', mustChange: 'true', failedCount: 0, lockedUntil: '', createdAt: nowIso_() });
  audit_(ctx, 'İstifadəçi yaradıldı', 'Users', id, fullName);
  return { bundle: bundle_(ctx), tempPassword: pw, username: username };
}

function resetPassword_(ctx, data) {
  requireAdmin_(ctx);
  var u = T_('Users').get(data.id);
  if (!u) throw new Error('İstifadəçi tapılmadı.');
  var pw = randomPassword_();
  var salt = newSalt_();
  T_('Users').update(u.id, { salt: salt, hash: hash_(pw, salt), mustChange: 'true', failedCount: 0, lockedUntil: '' });
  audit_(ctx, 'Parol sıfırlandı', 'Users', u.id, u.fullName);
  return { bundle: bundle_(ctx), tempPassword: pw, username: u.username };
}

/* ======================= AUDİT ======================= */

function audit_(ctx, action, entity, entityId, details) {
  try {
    T_('Audit').insert({
      ts: nowIso_(),
      userId: ctx.user ? ctx.user.id : '',
      userName: ctx.user ? ctx.user.fullName : (ctx.name || ''),
      action: action, entity: entity, entityId: entityId || '',
      details: String(details || '').slice(0, 500)
    });
  } catch (e) { /* audit xətası əsas əməliyyatı dayandırmamalıdır */ }
}

function auditLog_(ctx) {
  requireAdmin_(ctx);
  var rows = T_('Audit').all();
  return rows.slice(Math.max(0, rows.length - 500)).reverse().map(strip_);
}

/* ======================= MƏLUMAT PAKETİ ======================= */

function canEditVacancy_(ctx, v) { return isAdmin_(ctx) || (v && v.recruiterId === ctx.user.id); }

function bundle_(ctx) {
  var admin = isAdmin_(ctx);
  var uid = ctx.user.id;
  var vacancies = T_('Vacancies').all().filter(function (v) { return admin || v.recruiterId === uid; });
  var vIds = {}; vacancies.forEach(function (v) { vIds[v.id] = true; });
  var apps = T_('Applications').all().filter(function (a) { return vIds[a.vacancyId]; });
  var interviews = T_('Interviews').all().filter(function (m) { return vIds[m.vacancyId]; });
  var mIds = {}; interviews.forEach(function (m) { mIds[m.id] = true; });
  var scorecards = T_('Scorecards').all().filter(function (s) { return mIds[s.interviewId]; });

  // "Kor" qiymətləndirmə: hamı təhvil verənə qədər başqalarının balları gizlədilir
  var pendingBy = {};
  scorecards.forEach(function (s) { if (s.status !== SUBMITTED) pendingBy[s.interviewId] = true; });
  var scOut = scorecards.map(function (s) {
    var o = strip_(s);
    delete o.token;
    o.hasLink = !!s.token;
    o.linkToken = (s.status === PENDING && s.token) ? s.token : '';
    if (!admin && pendingBy[s.interviewId] && s.userId !== uid) {
      o.scores = ''; o.average = ''; o.comment = ''; o.recommendation = ''; o.hidden = true;
    }
    return o;
  });
  var sat = T_('Satisfaction').all().filter(function (r) { return vIds[r.vacancyId]; }).map(function (r) {
    var o = strip_(r); o.linkToken = r.status === PENDING ? r.token : ''; delete o.token; return o;
  });

  return {
    user: publicUser_(ctx.user),
    settings: getSettings_(),
    today: todayStr_(),
    users: T_('Users').all().map(function (u) {
      var p = publicUser_(u);
      if (!admin) { delete p.username; }
      return p;
    }),
    vacancies: vacancies.map(strip_),
    candidates: T_('Candidates').all().map(strip_),
    applications: apps.map(strip_),
    interviews: interviews.map(strip_),
    scorecards: scOut,
    satisfaction: sat
  };
}

/* ======================= VAKANSİYALAR ======================= */

function saveVacancy_(ctx, d) {
  var t = T_('Vacancies');
  var s = getSettings_();
  var title = String(d.title || '').trim();
  if (!title) throw new Error('Vakansiyanın adını daxil edin.');
  if (!d.company) throw new Error('Şirkəti seçin.');
  if (!isDate_(d.openedAt)) throw new Error('Açılma tarixini daxil edin.');
  if (d.deadline && !isDate_(d.deadline)) throw new Error('Son tarix düzgün deyil.');
  if (d.deadline && d.deadline < d.openedAt) throw new Error('Son tarix açılma tarixindən əvvəl ola bilməz.');
  var smin = d.salaryMin === '' || d.salaryMin == null ? '' : num_(d.salaryMin);
  var smax = d.salaryMax === '' || d.salaryMax == null ? '' : num_(d.salaryMax);
  if (smin !== '' && smax !== '' && smin > smax) throw new Error('Ə/H minimumu maksimumdan böyük ola bilməz.');
  var recruiterId = isAdmin_(ctx) && d.recruiterId ? d.recruiterId : ctx.user.id;
  if (!T_('Users').get(recruiterId)) throw new Error('Recruiter tapılmadı.');
  var headcount = Math.max(1, parseInt(d.headcount, 10) || 1);
  var difficulty = s.targetDays[d.difficulty] !== undefined ? d.difficulty : 'Orta';
  var minScore = num_(d.minScore);
  var rec = {
    company: d.company, department: d.department || '', hiringManager: String(d.hiringManager || '').trim(),
    recruiterId: recruiterId, title: title, headcount: headcount,
    salaryMin: smin === null ? '' : smin, salaryMax: smax === null ? '' : smax,
    difficulty: difficulty, priority: d.priority || 'Normal', minScore: minScore === null ? '' : minScore,
    openedAt: d.openedAt, deadline: d.deadline || '', note: d.note || '', updatedAt: nowIso_()
  };
  if (d.id) {
    var v = t.get(d.id);
    if (!canEditVacancy_(ctx, v)) throw new Error('Bu vakansiyanı dəyişməyə icazəniz yoxdur.');
    t.update(d.id, rec);
    audit_(ctx, 'Vakansiya dəyişdi', 'Vacancies', d.id, title);
    return { bundle: bundle_(ctx), id: d.id };
  }
  rec.id = t.nextId();
  rec.status = 'Açıq'; rec.pausedDays = 0; rec.pausedSince = ''; rec.closedAt = '';
  rec.createdAt = nowIso_(); rec.createdBy = ctx.user.id;
  t.insert(rec);
  audit_(ctx, 'Vakansiya yaradıldı', 'Vacancies', rec.id, title);
  return { bundle: bundle_(ctx), id: rec.id };
}

function setVacancyStatus_(ctx, d) {
  var t = T_('Vacancies');
  var v = t.get(d.id);
  if (!canEditVacancy_(ctx, v)) throw new Error('Bu vakansiyanı dəyişməyə icazəniz yoxdur.');
  var status = d.status;
  if (VACANCY_STATUSES.indexOf(status) < 0) throw new Error('Status düzgün deyil.');
  var today = isDate_(d.date) ? d.date : todayStr_();
  var patch = { status: status, updatedAt: nowIso_() };
  // dayandırılmış günləri hesabla
  if (v.status === 'Dayandırılıb' && status !== 'Dayandırılıb' && isDate_(v.pausedSince)) {
    patch.pausedDays = (parseInt(v.pausedDays, 10) || 0) + Math.max(0, daysBetween_(v.pausedSince, today));
    patch.pausedSince = '';
  }
  if (status === 'Dayandırılıb') patch.pausedSince = today;
  if (status === 'Bağlandı' || status === 'Ləğv edildi') patch.closedAt = today;
  if (status === 'Açıq') patch.closedAt = '';
  t.update(v.id, patch);
  audit_(ctx, 'Vakansiya statusu: ' + status, 'Vacancies', v.id, v.title);
}

/* ======================= NAMİZƏDLƏR ======================= */

function normPhone_(p) { return String(p || '').replace(/\D/g, '').slice(-9); }

function saveCandidate_(ctx, d) {
  var t = T_('Candidates');
  var name = String(d.fullName || '').trim();
  if (!name) throw new Error('Namizədin adını daxil edin.');
  var phone = String(d.phone || '').trim(), email = String(d.email || '').trim().toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Email düzgün deyil.');
  if (!d.forceDuplicate) {
    var np = normPhone_(phone);
    var dup = t.find(function (c) {
      if (c.id === d.id) return false;
      return (np.length >= 7 && normPhone_(c.phone) === np) || (email && c.email.toLowerCase() === email);
    });
    if (dup) throw new Error('DUPLICATE:' + dup.id + ':Bu telefon və ya email ilə namizəd artıq bazada var — ' + dup.fullName + ' (' + dup.id + ').');
  }
  var exp = num_(d.salaryExpectation);
  var rec = {
    fullName: name, phone: phone, email: email, cvUrl: String(d.cvUrl || '').trim(),
    source: d.source || '', sourceNote: d.sourceNote || '', salaryExpectation: exp === null ? '' : exp, note: d.note || ''
  };
  if (rec.cvUrl && !/^https?:\/\//i.test(rec.cvUrl)) throw new Error('CV linki http:// və ya https:// ilə başlamalıdır.');
  if (d.id) {
    if (!t.get(d.id)) throw new Error('Namizəd tapılmadı.');
    t.update(d.id, rec);
    audit_(ctx, 'Namizəd dəyişdi', 'Candidates', d.id, name);
    return { bundle: bundle_(ctx), id: d.id };
  }
  rec.id = t.nextId(); rec.createdAt = nowIso_(); rec.createdBy = ctx.user.id;
  t.insert(rec);
  audit_(ctx, 'Namizəd yaradıldı', 'Candidates', rec.id, name);
  return { bundle: bundle_(ctx), id: rec.id };
}

/* ======================= MƏRHƏLƏLƏR (MÜRACİƏTLƏR) ======================= */

function addApplication_(ctx, d) {
  var v = T_('Vacancies').get(d.vacancyId);
  if (!v) throw new Error('Vakansiya tapılmadı.');
  if (!canEditVacancy_(ctx, v)) throw new Error('Bu vakansiyaya namizəd əlavə etməyə icazəniz yoxdur.');
  if (v.status !== 'Açıq') throw new Error('Yalnız açıq vakansiyaya namizəd əlavə etmək olar.');
  var c = T_('Candidates').get(d.candidateId);
  if (!c) throw new Error('Namizəd tapılmadı.');
  var t = T_('Applications');
  var exists = t.find(function (a) { return a.vacancyId === v.id && a.candidateId === c.id; });
  if (exists) throw new Error('Bu namizəd artıq bu vakansiyaya əlavə olunub (' + exists.id + ').');
  var stage = STAGES.indexOf(d.stage) >= 0 && ['Təklif', 'İşə qəbul', 'İmtina'].indexOf(d.stage) < 0 ? d.stage : 'Müraciət';
  var now = nowIso_();
  var rec = {
    id: t.nextId(), vacancyId: v.id, candidateId: c.id, recruiterId: v.recruiterId, stage: stage, stageChangedAt: now,
    stageHistory: JSON.stringify([{ stage: stage, at: now, by: ctx.user.id }]), createdAt: now, updatedAt: now
  };
  t.insert(rec);
  audit_(ctx, 'Namizəd vakansiyaya əlavə olundu', 'Applications', rec.id, c.fullName + ' → ' + v.title);
  return { bundle: bundle_(ctx), id: rec.id };
}

function updateApplication_(ctx, d) {
  var t = T_('Applications');
  var a = t.get(d.id);
  if (!a) throw new Error('Qeyd tapılmadı.');
  var v = T_('Vacancies').get(a.vacancyId);
  if (!canEditVacancy_(ctx, v)) throw new Error('İcazəniz yoxdur.');
  var s = getSettings_();
  var patch = { updatedAt: nowIso_() };
  var f = d.fields || {};
  var newStage = d.stage && d.stage !== a.stage ? d.stage : null;
  if (newStage && STAGES.indexOf(newStage) < 0) throw new Error('Mərhələ düzgün deyil.');
  if (newStage && (a.stage === 'İşə qəbul' || a.stage === 'İmtina') && !isAdmin_(ctx) && !d.reopen) {
    throw new Error('Bu namizədin prosesi bitib. Yenidən açmaq üçün "Prosesi bərpa et" düyməsindən istifadə edin.');
  }

  // Sahələr (təklif, sınaq müddəti və s.)
  ['offerDate', 'offerSalary', 'offerResponse', 'offerResponseDate', 'offerDeclineReason', 'hireDate', 'probationEnd', 'probationResult', 'probationNote', 'rejectBy', 'rejectReason'].forEach(function (k) {
    if (f[k] !== undefined) patch[k] = f[k];
  });
  var target = newStage || a.stage;
  var merged = {}; Object.keys(a).forEach(function (k) { merged[k] = a[k]; }); Object.keys(patch).forEach(function (k) { merged[k] = patch[k]; });

  if (target === 'Təklif') {
    if (!isDate_(merged.offerDate)) throw new Error('Təklif tarixini daxil edin.');
    if (num_(merged.offerSalary) === null) throw new Error('Təklif olunan ə/h məbləğini daxil edin.');
  }
  if (merged.offerResponse === 'İmtina etdi' && !merged.offerDeclineReason) throw new Error('Təklifdən imtina səbəbini seçin.');
  if (target === 'İşə qəbul') {
    if (!isDate_(merged.hireDate)) throw new Error('İşə qəbul tarixini daxil edin.');
    if (!merged.offerResponse || merged.offerResponse === PENDING) { patch.offerResponse = 'Qəbul etdi'; merged.offerResponse = 'Qəbul etdi'; }
    if (merged.offerResponse !== 'Qəbul etdi') throw new Error('Təklifdən imtina edən namizəd işə qəbul edilə bilməz.');
    if (!isDate_(merged.offerResponseDate)) { patch.offerResponseDate = merged.hireDate; }
    if (!isDate_(merged.offerDate)) { patch.offerDate = patch.offerResponseDate || merged.offerResponseDate || merged.hireDate; }
    if (!isDate_(merged.probationEnd)) patch.probationEnd = addMonths_(merged.hireDate, parseInt(s.probationMonths, 10) || 3);
  }
  if (target === 'İmtina') {
    if (['Biz', 'Namizəd'].indexOf(merged.rejectBy) < 0) throw new Error('İmtinanı kimin etdiyini seçin.');
    if (!merged.rejectReason) throw new Error('İmtina səbəbini seçin.');
    // Təklif mərhələsində namizəd imtina edirsə — təklifdən imtina sayılır
    if (newStage && a.stage === 'Təklif' && merged.rejectBy === 'Namizəd') {
      patch.offerResponse = 'İmtina etdi';
      patch.offerDeclineReason = merged.rejectReason;
      if (!isDate_(merged.offerResponseDate)) patch.offerResponseDate = todayStr_();
    }
  }
  if (merged.probationResult && ['Keçdi', 'Keçmədi', ''].indexOf(merged.probationResult) < 0) throw new Error('Sınaq nəticəsi düzgün deyil.');

  if (newStage) {
    var hist = [];
    try { hist = JSON.parse(a.stageHistory || '[]'); } catch (e) { hist = []; }
    var now = nowIso_();
    hist.push({ stage: newStage, at: now, by: ctx.user.id });
    patch.stage = newStage; patch.stageChangedAt = now; patch.stageHistory = JSON.stringify(hist);
    if (newStage !== 'İmtina' && a.stage === 'İmtina') { patch.rejectBy = ''; patch.rejectReason = ''; }
  }
  t.update(a.id, patch);
  var c = T_('Candidates').get(a.candidateId);
  audit_(ctx, newStage ? ('Mərhələ: ' + a.stage + ' → ' + newStage) : 'Müraciət yeniləndi', 'Applications', a.id, c ? c.fullName : '');

  var hired = T_('Applications').filter(function (x) { return x.vacancyId === v.id && x.stage === 'İşə qəbul'; }).length;
  var filled = newStage === 'İşə qəbul' && v.status === 'Açıq' && hired >= (parseInt(v.headcount, 10) || 1);
  return { bundle: bundle_(ctx), vacancyFilled: filled, vacancyId: v.id };
}

/* ======================= MÜSAHİBƏLƏR ======================= */

function saveInterview_(ctx, d) {
  var t = T_('Interviews');
  var a = T_('Applications').get(d.applicationId);
  if (!a) throw new Error('Namizəd və vakansiyanı seçin.');
  var v = T_('Vacancies').get(a.vacancyId);
  if (!canEditVacancy_(ctx, v)) throw new Error('İcazəniz yoxdur.');
  if (!isDate_(d.date)) throw new Error('Müsahibə tarixini daxil edin.');
  if (minutesOf_(d.startTime) === null) throw new Error('Başlama saatını daxil edin.');
  if (d.endTime && minutesOf_(d.endTime) === null) throw new Error('Bitmə saatı düzgün deyil.');
  if (d.endTime && minutesOf_(d.endTime) <= minutesOf_(d.startTime)) throw new Error('Bitmə saatı başlama saatından sonra olmalıdır.');
  var attended = d.attendance === 'İştirak edib';
  var absent = d.attendance === 'İştirak etməyib';
  if (absent && !d.absenceReason) throw new Error('İştirak etməmə səbəbini seçin.');
  if (attended && !d.endTime) throw new Error('Namizəd iştirak edibsə, bitmə saatını daxil edin.');
  if (attended && !d.result) throw new Error('Namizəd iştirak edibsə, nəticəni seçin.');
  if (d.date > todayStr_() && d.attendance) throw new Error('Gələcək tarixli müsahibə üçün iştirak statusu qeyd oluna bilməz.');
  var rec = {
    applicationId: a.id, vacancyId: v.id, candidateId: a.candidateId, recruiterId: v.recruiterId,
    type: d.type || '', format: d.format || '', date: d.date, startTime: d.startTime, endTime: absent ? '' : (d.endTime || ''),
    participantsHR: d.participantsHR || '', participantsManagers: d.participantsManagers || '',
    taskType: d.taskType || '', taskResult: d.taskResult || '',
    attendance: d.attendance || '', absenceReason: absent ? d.absenceReason : '',
    comment: absent ? '' : (d.comment || ''), result: attended ? (d.result || '') : ''
  };
  var id = d.id;
  if (id) {
    var old = t.get(id);
    if (!old) throw new Error('Müsahibə tapılmadı.');
    if (!old.resultEnteredAt && rec.attendance) rec.resultEnteredAt = nowIso_();
    if (!rec.attendance) rec.resultEnteredAt = '';
    t.update(id, rec);
    audit_(ctx, 'Müsahibə dəyişdi', 'Interviews', id, rec.date + ' ' + rec.startTime);
  } else {
    id = t.nextId();
    rec.id = id; rec.createdAt = nowIso_(); rec.createdBy = ctx.user.id;
    rec.resultEnteredAt = rec.attendance ? nowIso_() : '';
    t.insert(rec);
    audit_(ctx, 'Müsahibə yaradıldı', 'Interviews', id, rec.date + ' ' + rec.startTime);
    // namizəd "Müraciət" və ya "İlkin söhbət" mərhələsindədirsə avtomatik "Müsahibə"yə keçir
    if (a.stage === 'Müraciət' || a.stage === 'İlkin söhbət') {
      updateApplication_(ctx, { id: a.id, stage: 'Müsahibə' });
    }
  }
  return { bundle: bundle_(ctx), id: id };
}

function deleteInterview_(ctx, d) {
  var m = T_('Interviews').get(d.id);
  if (!m) throw new Error('Müsahibə tapılmadı.');
  var v = T_('Vacancies').get(m.vacancyId);
  if (!canEditVacancy_(ctx, v)) throw new Error('İcazəniz yoxdur.');
  var sc = T_('Scorecards').filter(function (s) { return s.interviewId === m.id; });
  if (sc.some(function (s) { return s.status === SUBMITTED; })) throw new Error('Qiymətləndirməsi olan müsahibə silinə bilməz.');
  sc.forEach(function (s) { T_('Scorecards').remove(s.id); });
  T_('Interviews').remove(m.id);
  audit_(ctx, 'Müsahibə silindi', 'Interviews', m.id, m.date);
}

/* ======================= QİYMƏTLƏNDİRMƏ KARTLARI ======================= */

function validateScores_(scores, settings) {
  var out = {}, sum = 0, n = 0;
  (settings.criteria || []).forEach(function (c) {
    var v = parseInt(scores && scores[c], 10);
    if (!(v >= 1 && v <= 5)) throw new Error('"' + c + '" meyarı üzrə 1–5 arası bal verin.');
    out[c] = v; sum += v; n++;
  });
  if (!n) throw new Error('Qiymətləndirmə meyarları təyin olunmayıb.');
  return { scores: out, average: Math.round(sum / n * 100) / 100 };
}

var RECOMMENDATIONS = ['Tövsiyə edirəm', 'Tərəddüd edirəm', 'Tövsiyə etmirəm'];

function saveMyScorecard_(ctx, d) {
  var m = T_('Interviews').get(d.interviewId);
  if (!m) throw new Error('Müsahibə tapılmadı.');
  var v = T_('Vacancies').get(m.vacancyId);
  if (!canEditVacancy_(ctx, v)) throw new Error('İcazəniz yoxdur.');
  if (m.attendance !== 'İştirak edib') throw new Error('Yalnız keçirilmiş müsahibəni qiymətləndirmək olar.');
  var r = validateScores_(d.scores, getSettings_());
  if (RECOMMENDATIONS.indexOf(d.recommendation) < 0) throw new Error('Tövsiyənizi seçin.');
  var t = T_('Scorecards');
  var mine = t.find(function (s) { return s.interviewId === m.id && s.userId === ctx.user.id; });
  var rec = { scores: JSON.stringify(r.scores), average: r.average, recommendation: d.recommendation, comment: d.comment || '', status: SUBMITTED, submittedAt: nowIso_() };
  if (mine) t.update(mine.id, rec);
  else {
    rec.id = t.nextId(); rec.interviewId = m.id; rec.evaluatorName = ctx.user.fullName; rec.evaluatorRole = 'İR əməkdaşı';
    rec.userId = ctx.user.id; rec.token = ''; rec.createdAt = nowIso_();
    t.insert(rec);
  }
  audit_(ctx, 'Qiymətləndirmə kartı dolduruldu', 'Scorecards', m.id, r.average);
}

function newToken_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }

function createScorecardLink_(ctx, d) {
  var m = T_('Interviews').get(d.interviewId);
  if (!m) throw new Error('Müsahibə tapılmadı.');
  var v = T_('Vacancies').get(m.vacancyId);
  if (!canEditVacancy_(ctx, v)) throw new Error('İcazəniz yoxdur.');
  var name = String(d.evaluatorName || '').trim();
  if (!name) throw new Error('Qiymətləndirəcək şəxsin adını daxil edin.');
  var t = T_('Scorecards');
  var token = newToken_();
  var id = t.nextId();
  t.insert({ id: id, interviewId: m.id, evaluatorName: name, evaluatorRole: d.evaluatorRole || 'Struktur bölmə rəhbəri', userId: '', token: token, status: PENDING, scores: '', average: '', recommendation: '', comment: '', submittedAt: '', createdAt: nowIso_() });
  audit_(ctx, 'Qiymətləndirmə linki yaradıldı', 'Scorecards', id, name);
  return { bundle: bundle_(ctx), token: token };
}

function createSatisfactionLink_(ctx, d) {
  var v = T_('Vacancies').get(d.vacancyId);
  if (!v) throw new Error('Vakansiya tapılmadı.');
  if (!canEditVacancy_(ctx, v)) throw new Error('İcazəniz yoxdur.');
  var name = String(d.managerName || v.hiringManager || '').trim();
  if (!name) throw new Error('Rəhbərin adını daxil edin.');
  var t = T_('Satisfaction');
  var existing = t.find(function (r) { return r.vacancyId === v.id && r.status === PENDING; });
  if (existing) return { bundle: bundle_(ctx), token: existing.token };
  var token = newToken_();
  var id = t.nextId();
  t.insert({ id: id, vacancyId: v.id, recruiterId: v.recruiterId, managerName: name, token: token, status: PENDING, score: '', comment: '', submittedAt: '', createdAt: nowIso_() });
  audit_(ctx, 'Məmnuniyyət linki yaradıldı', 'Satisfaction', id, name);
  return { bundle: bundle_(ctx), token: token };
}

function cancelLink_(ctx, d) {
  var tbl = d.kind === 'sat' ? 'Satisfaction' : 'Scorecards';
  var r = T_(tbl).get(d.id);
  if (!r) throw new Error('Link tapılmadı.');
  if (r.status !== PENDING) throw new Error('Doldurulmuş qiymətləndirmə ləğv edilə bilməz.');
  var vacancyId = tbl === 'Satisfaction' ? r.vacancyId : (T_('Interviews').get(r.interviewId) || {}).vacancyId;
  if (!canEditVacancy_(ctx, T_('Vacancies').get(vacancyId))) throw new Error('İcazəniz yoxdur.');
  T_(tbl).remove(r.id);
  audit_(ctx, 'Link ləğv edildi', tbl, r.id, '');
}

function findByToken_(token) {
  token = String(token || '');
  if (token.length < 32) return null;
  var s = T_('Scorecards').find(function (r) { return r.token === token; });
  if (s) return { kind: 'sc', row: s };
  var r = T_('Satisfaction').find(function (x) { return x.token === token; });
  if (r) return { kind: 'sat', row: r };
  return null;
}

function linkExpired_(row) {
  var created = new Date(row.createdAt);
  return !isNaN(created.getTime()) && (Date.now() - created.getTime()) > APP.LINK_DAYS * 86400000;
}

function publicForm_(d) {
  var f = findByToken_(d.token);
  if (!f) throw new Error('Link etibarsızdır və ya ləğv edilib.');
  if (f.row.status === SUBMITTED) return { submitted: true };
  if (linkExpired_(f.row)) throw new Error('Linkin müddəti bitib. Recruiterdən yeni link istəyin.');
  var s = getSettings_();
  if (f.kind === 'sc') {
    var m = T_('Interviews').get(f.row.interviewId) || {};
    var c = T_('Candidates').get(m.candidateId) || {};
    var v = T_('Vacancies').get(m.vacancyId) || {};
    return {
      kind: 'sc', evaluatorName: f.row.evaluatorName, candidate: c.fullName, vacancy: v.title, company: v.company,
      date: m.date, time: m.startTime, criteria: s.criteria, scale: s.scale, recommendations: RECOMMENDATIONS
    };
  }
  var vac = T_('Vacancies').get(f.row.vacancyId) || {};
  var rec = T_('Users').get(f.row.recruiterId) || {};
  return { kind: 'sat', managerName: f.row.managerName, vacancy: vac.title, company: vac.company, recruiter: rec.fullName };
}

function publicSubmit_(d) {
  resetCache_();
  var f = findByToken_(d.token);
  if (!f) throw new Error('Link etibarsızdır və ya ləğv edilib.');
  if (f.row.status === SUBMITTED) throw new Error('Bu qiymətləndirmə artıq təhvil verilib.');
  if (linkExpired_(f.row)) throw new Error('Linkin müddəti bitib.');
  if (f.kind === 'sc') {
    var r = validateScores_(d.scores, getSettings_());
    if (RECOMMENDATIONS.indexOf(d.recommendation) < 0) throw new Error('Tövsiyənizi seçin.');
    T_('Scorecards').update(f.row.id, { scores: JSON.stringify(r.scores), average: r.average, recommendation: d.recommendation, comment: String(d.comment || '').slice(0, 3000), status: SUBMITTED, submittedAt: nowIso_() });
    audit_({ name: f.row.evaluatorName + ' (link)' }, 'Qiymətləndirmə linklə təhvil verildi', 'Scorecards', f.row.id, r.average);
  } else {
    var score = parseInt(d.score, 10);
    if (!(score >= 1 && score <= 5)) throw new Error('1–5 arası qiymət seçin.');
    T_('Satisfaction').update(f.row.id, { score: score, comment: String(d.comment || '').slice(0, 3000), status: SUBMITTED, submittedAt: nowIso_() });
    audit_({ name: f.row.managerName + ' (link)' }, 'Rəhbər məmnuniyyəti təhvil verildi', 'Satisfaction', f.row.id, score);
  }
  return { ok: true };
}

/* ======================= PERFORMANS ======================= */

function performanceAction_(ctx, d) {
  var s = getSettings_();
  var from = isDate_(d.from) ? d.from : todayStr_().slice(0, 8) + '01';
  var to = isDate_(d.to) ? d.to : todayStr_();
  var users = T_('Users').all().filter(function (u) { return u.active === 'true' || isAdmin_(ctx); });
  var ids = isAdmin_(ctx) ? users.map(function (u) { return u.id; }) : [ctx.user.id];
  if (d.recruiterId && ids.indexOf(d.recruiterId) >= 0) ids = [d.recruiterId];
  var data = {
    vacancies: T_('Vacancies').all(), applications: T_('Applications').all(), interviews: T_('Interviews').all(),
    candidates: T_('Candidates').all(), satisfaction: T_('Satisfaction').all(), users: T_('Users').all()
  };
  return computePerformance_(data, s, { from: from, to: to, today: todayStr_(), recruiterIds: ids, company: d.company || '' });
}

function clamp100_(x) { return Math.max(0, Math.min(100, x)); }
function round1_(x) { return x === null || x === undefined ? null : Math.round(x * 10) / 10; }

/** Saf funksiya — testlərdə də istifadə olunur. */
function computePerformance_(data, s, opt) {
  var from = opt.from, to = opt.to, today = opt.today || to;
  var W = s.weights, TG = s.targets;
  var usersById = {}; data.users.forEach(function (u) { usersById[u.id] = u; });
  var candById = {}; data.candidates.forEach(function (c) { candById[c.id] = c; });

  function forRecruiter(rid, rFrom, rTo) {
    var V = data.vacancies.filter(function (v) { return v.recruiterId === rid && (!opt.company || v.company === opt.company); });
    var vIds = {}; V.forEach(function (v) { vIds[v.id] = v; });
    var A = data.applications.filter(function (a) { return vIds[a.vacancyId]; });
    var M = data.interviews.filter(function (m) { return vIds[m.vacancyId]; });
    var SAT = data.satisfaction.filter(function (x) { return vIds[x.vacancyId] && x.status === SUBMITTED; });

    function deadlineOf(v) {
      if (isDate_(v.deadline)) return v.deadline;
      var td = s.targetDays[v.difficulty] || s.targetDays['Orta'] || 30;
      return isDate_(v.openedAt) ? addDays_(v.openedAt, td) : '';
    }
    function fillDateOf(v) {
      var best = '';
      A.forEach(function (a) {
        if (a.vacancyId === v.id && a.stage === 'İşə qəbul') {
          var d = isDate_(a.offerResponseDate) ? a.offerResponseDate : a.hireDate;
          if (isDate_(d) && d > best) best = d;
        }
      });
      return best || v.closedAt;
    }
    var metrics = {};

    // P1, P2: bağlanan vakansiyalar
    var closed = V.filter(function (v) { return v.status === 'Bağlandı' && inRange_(v.closedAt, rFrom, rTo); });
    var onTime = 0, p2scores = [], p2days = [];
    closed.forEach(function (v) {
      var fd = fillDateOf(v);
      var dl = deadlineOf(v);
      if (isDate_(fd) && isDate_(dl) && fd <= dl) onTime++;
      var eff = daysBetween_(v.openedAt, fd);
      if (eff !== null) {
        eff = Math.max(0, eff - (parseInt(v.pausedDays, 10) || 0));
        var target = s.targetDays[v.difficulty] || s.targetDays['Orta'] || 30;
        p2days.push(eff);
        p2scores.push(eff <= target ? 100 : clamp100_(target / eff * 100));
      }
    });
    metrics.P1 = closed.length ? { n: closed.length, value: onTime / closed.length * 100, unit: '%' } : { n: 0 };
    if (metrics.P1.n) metrics.P1.score = clamp100_(metrics.P1.value / TG.P1 * 100);
    metrics.P2 = p2scores.length ? { n: p2scores.length, value: avg_(p2days), unit: 'gün', score: avg_(p2scores) } : { n: 0 };

    // P3: təklifin qəbulu
    var offers = A.filter(function (a) { return (a.offerResponse === 'Qəbul etdi' || a.offerResponse === 'İmtina etdi') && inRange_(a.offerResponseDate, rFrom, rTo); });
    var acc = offers.filter(function (a) { return a.offerResponse === 'Qəbul etdi'; }).length;
    metrics.P3 = offers.length ? { n: offers.length, value: acc / offers.length * 100, unit: '%' } : { n: 0 };
    if (metrics.P3.n) metrics.P3.score = clamp100_(metrics.P3.value / TG.P3 * 100);

    // P4: sınaq müddəti
    var prob = A.filter(function (a) { return (a.probationResult === 'Keçdi' || a.probationResult === 'Keçmədi') && inRange_(a.probationEnd, rFrom, rTo); });
    var passed = prob.filter(function (a) { return a.probationResult === 'Keçdi'; }).length;
    metrics.P4 = prob.length ? { n: prob.length, value: passed / prob.length * 100, unit: '%' } : { n: 0 };
    if (metrics.P4.n) metrics.P4.score = clamp100_(metrics.P4.value / TG.P4 * 100);

    // P5: rəhbər məmnuniyyəti
    var satIn = SAT.filter(function (x) { return inRange_(toDay_(x.submittedAt), rFrom, rTo); });
    metrics.P5 = satIn.length ? { n: satIn.length, value: avg_(satIn.map(function (x) { return +x.score; })), unit: '/5' } : { n: 0 };
    if (metrics.P5.n) metrics.P5.score = clamp100_(metrics.P5.value / TG.P5 * 100);

    // P6: gəlməmə faizi
    var Mp = M.filter(function (m) { return inRange_(m.date, rFrom, rTo); });
    var withAtt = Mp.filter(function (m) { return m.attendance === 'İştirak edib' || m.attendance === 'İştirak etməyib'; });
    var noShow = withAtt.filter(function (m) { return m.attendance === 'İştirak etməyib'; }).length;
    metrics.P6 = withAtt.length ? { n: withAtt.length, value: noShow / withAtt.length * 100, unit: '%' } : { n: 0 };
    if (metrics.P6.n) metrics.P6.score = metrics.P6.value <= TG.P6 ? 100 : clamp100_(TG.P6 / metrics.P6.value * 100);

    // P7: məlumatın vaxtında daxil edilməsi
    var lim = parseInt(s.timelyEntryDays, 10); if (isNaN(lim)) lim = 1;
    var due = Mp.filter(function (m) { return m.date <= today; });
    var timely = 0, dueCount = 0;
    due.forEach(function (m) {
      var entered = toDay_(m.resultEnteredAt);
      if (entered) { dueCount++; if (daysBetween_(m.date, entered) <= lim) timely++; }
      else if (daysBetween_(m.date, today) > lim) { dueCount++; } // hələ də daxil edilməyib və gecikib
    });
    metrics.P7 = dueCount ? { n: dueCount, value: timely / dueCount * 100, unit: '%' } : { n: 0 };
    if (metrics.P7.n) metrics.P7.score = clamp100_(metrics.P7.value / TG.P7 * 100);

    // P8: bağlama faizi (son tarixi bu dövrə düşən və ya bu dövrdə bağlanan vakansiyalar)
    var assess = V.filter(function (v) {
      if (v.status === 'Ləğv edildi') return false;
      var dl = deadlineOf(v);
      return inRange_(dl, rFrom, rTo) && dl <= today || (v.status === 'Bağlandı' && inRange_(v.closedAt, rFrom, rTo));
    });
    var assessClosed = assess.filter(function (v) { return v.status === 'Bağlandı'; }).length;
    metrics.P8 = assess.length ? { n: assess.length, value: assessClosed / assess.length * 100, unit: '%' } : { n: 0 };
    if (metrics.P8.n) metrics.P8.score = clamp100_(metrics.P8.value / TG.P8 * 100);

    // Ümumi bal (məlumatı olmayan göstəricinin çəkisi digərlərinə bölünür)
    var wSum = 0, sSum = 0, withData = 0;
    Object.keys(W).forEach(function (k) {
      var mt = metrics[k];
      if (mt && mt.n > 0 && mt.score !== undefined) { wSum += +W[k]; sSum += +W[k] * mt.score; withData++; }
      if (mt) { mt.value = round1_(mt.value); if (mt.score !== undefined) mt.score = round1_(mt.score); mt.weight = +W[k]; }
    });
    var minInt = parseInt(s.minInterviews, 10) || 0;
    var enough = (withAtt.length >= minInt || closed.length >= 1) && withData >= 2 && wSum > 0;
    var total = enough ? round1_(sSum / wSum) : null;

    // Məlumat üçün göstəricilər
    var attended = Mp.filter(function (m) { return m.attendance === 'İştirak edib'; });
    var minutes = 0, timed = 0;
    attended.forEach(function (m) {
      var a1 = minutesOf_(m.startTime), b1 = minutesOf_(m.endTime);
      if (a1 !== null && b1 !== null && b1 > a1) { minutes += b1 - a1; timed++; }
    });
    var hires = A.filter(function (a) { return a.stage === 'İşə qəbul' && inRange_(a.hireDate, rFrom, rTo); });
    var Ap = A.filter(function (a) { return inRange_(toDay_(a.createdAt), rFrom, rTo); });
    var funnel = STAGES.slice(0, 7).map(function (st, idx) {
      var cnt = Ap.filter(function (a) {
        var h = []; try { h = JSON.parse(a.stageHistory || '[]'); } catch (e) { h = []; }
        var reached = h.some(function (x) { return STAGES.indexOf(x.stage) >= idx && x.stage !== 'İmtina'; });
        return reached || (idx === 0);
      }).length;
      return { stage: st, count: cnt };
    });
    var sources = {};
    Ap.forEach(function (a) {
      var src = (candById[a.candidateId] || {}).source || 'Qeyd olunmayıb';
      sources[src] = sources[src] || { source: src, applications: 0, hires: 0 };
      sources[src].applications++;
    });
    hires.forEach(function (a) {
      var src = (candById[a.candidateId] || {}).source || 'Qeyd olunmayıb';
      sources[src] = sources[src] || { source: src, applications: 0, hires: 0 };
      sources[src].hires++;
    });
    var rejectReasons = {};
    A.filter(function (a) { return a.stage === 'İmtina' && inRange_(toDay_(a.stageChangedAt), rFrom, rTo); }).forEach(function (a) {
      var key = (a.rejectBy || '?') + ': ' + (a.rejectReason || '?');
      rejectReasons[key] = (rejectReasons[key] || 0) + 1;
    });

    return {
      metrics: metrics, total: total, enough: enough,
      info: {
        activeVacancies: V.filter(function (v) { return v.status === 'Açıq' || v.status === 'Dayandırılıb'; }).length,
        newVacancies: V.filter(function (v) { return inRange_(v.openedAt, rFrom, rTo); }).length,
        closedVacancies: closed.length,
        interviews: Mp.length, attended: attended.length, noShows: noShow,
        totalMinutes: minutes, avgMinutes: timed ? Math.round(minutes / timed) : null,
        hires: hires.length, interviewsPerHire: hires.length ? round1_(attended.length / hires.length) : null,
        funnel: funnel,
        sources: Object.keys(sources).map(function (k) { return sources[k]; }).sort(function (a, b) { return b.hires - a.hires || b.applications - a.applications; }),
        rejectReasons: Object.keys(rejectReasons).map(function (k) { return { reason: k, count: rejectReasons[k] }; }).sort(function (a, b) { return b.count - a.count; })
      }
    };
  }

  function monthsBack(n) {
    var out = [], base = to.slice(0, 7) + '-01';
    for (var i = n - 1; i >= 0; i--) {
      var start = addMonths_(base, -i);
      var end = addDays_(addMonths_(start, 1), -1);
      out.push({ label: start.slice(0, 7), from: start, to: end });
    }
    return out;
  }
  var months = monthsBack(6);

  var rows = opt.recruiterIds.map(function (rid) {
    var u = usersById[rid] || { fullName: rid };
    var r = forRecruiter(rid, from, to);
    r.recruiterId = rid; r.name = u.fullName; r.active = u.active === 'true';
    r.trend = months.map(function (mo) { var x = forRecruiter(rid, mo.from, mo.to); return { month: mo.label, total: x.total }; });
    return r;
  }).filter(function (r) {
    var u = usersById[r.recruiterId] || {};
    var hasData = r.info.activeVacancies || r.info.interviews || r.info.closedVacancies;
    return hasData || (r.active && u.role !== 'admin');
  });

  rows.sort(function (a, b) { return (b.total === null ? -1 : b.total) - (a.total === null ? -1 : a.total); });
  return { from: from, to: to, rows: rows, weights: W, targets: s.targets };
}

function avg_(arr) { if (!arr.length) return null; var s = 0; arr.forEach(function (x) { s += x; }); return s / arr.length; }

/* ======================= QURAŞDIRMA (redaktordan işə salın) ======================= */

/**
 * Bir dəfə işə salın: baza vərəqlərini yaradır və admin istifadəçi açır.
 * Admin parolu "Execution log"-da göstəriləcək.
 */
function platformaQur() {
  var ss = ss_();
  Object.keys(SCHEMA).forEach(function (name) {
    var full = APP.PREFIX + name;
    var sh = ss.getSheetByName(full);
    if (!sh) sh = ss.insertSheet(full);
    var cols = SCHEMA[name];
    if (sh.getMaxColumns() < cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), cols.length - sh.getMaxColumns());
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#e8eef7');
    sh.setFrozenRows(1);
  });
  resetCache_();
  var users = T_('Users');
  var out = 'Baza hazırdır.';
  if (!users.all().length) {
    var pw = randomPassword_();
    var salt = newSalt_();
    users.insert({ id: 'U-0001', username: 'admin', fullName: 'Administrator', role: 'admin', salt: salt, hash: hash_(pw, salt), active: 'true', mustChange: 'true', failedCount: 0, lockedUntil: '', createdAt: nowIso_() });
    out += '\nAdmin istifadəçi adı: admin\nMüvəqqəti parol: ' + pw + '\n(İlk girişdə parolu dəyişməyiniz istəniləcək.)';
  }
  Logger.log(out);
  try { SpreadsheetApp.getUi().alert(out); } catch (e) { /* redaktordan işə salındıqda UI olmaya bilər */ }
  return out;
}

/** Admin parolunu unutduqda redaktordan işə salın. */
function adminParolunuSifirla() {
  resetCache_();
  var u = T_('Users').find(function (r) { return r.role === 'admin' && r.active === 'true'; });
  if (!u) throw new Error('Aktiv admin tapılmadı.');
  var pw = randomPassword_();
  var salt = newSalt_();
  T_('Users').update(u.id, { salt: salt, hash: hash_(pw, salt), mustChange: 'true', failedCount: 0, lockedUntil: '' });
  var msg = 'İstifadəçi: ' + u.username + '\nYeni müvəqqəti parol: ' + pw;
  Logger.log(msg);
  return msg;
}

/** Köhnə "Vakansiyalar bazası" və "Müsahibələr bazası" vərəqlərindən məlumatları köçürür. */
function kohneMelumatlariKocur() {
  resetCache_();
  var ss = ss_();
  var ctx = { user: T_('Users').find(function (r) { return r.role === 'admin'; }) };
  var log = [];

  function oldDate(v) {
    if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
    var m = String(v || '').trim().match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})$/);
    if (!m) return '';
    var y = m[3].length === 2 ? '20' + m[3] : m[3];
    return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  function oldTime(v) {
    if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, tz_(), 'HH:mm');
    var m = String(v || '').match(/(\d{1,2}):(\d{2})/);
    return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
  }
  function firstNum(v) { var m = String(v || '').replace(/\s/g, '').match(/\d+/g); return m ? +m[m.length - 1] : ''; }
  function userByName(name) {
    name = String(name || '').trim();
    if (!name) return ctx.user;
    var u = T_('Users').find(function (r) { return r.fullName.trim().toLowerCase() === name.toLowerCase(); });
    if (u) return u;
    var base = name.split(/\s+/).slice(0, 2).join('.').toLowerCase()
      .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/[^a-z0-9.]/g, '');
    var uname = base || ('user' + Date.now());
    var i = 1; while (T_('Users').find(function (r) { return r.username === uname; })) uname = base + (++i);
    var salt = newSalt_();
    var id = T_('Users').nextId();
    T_('Users').insert({ id: id, username: uname, fullName: name, role: 'recruiter', salt: salt, hash: hash_(randomPassword_(), salt), active: 'true', mustChange: 'true', failedCount: 0, lockedUntil: '', createdAt: nowIso_() });
    log.push('Yeni istifadəçi: ' + name + ' (' + uname + ') — parolu Admin bölməsindən sıfırlayın.');
    return T_('Users').get(id);
  }

  // Vakansiyalar
  var vsh = ss.getSheetByName('Vakansiyalar bazası');
  var vacByTitle = {};
  if (vsh && vsh.getLastRow() > 1) {
    vsh.getRange(2, 1, vsh.getLastRow() - 1, 10).getValues().forEach(function (r) {
      if (!r[5]) return;
      var rec = userByName(r[4]);
      var opened = oldDate(r[9]) || todayStr_();
      var id = T_('Vacancies').nextId();
      var sal = String(r[6] || '');
      var nums = (sal.replace(/\s/g, '').match(/\d+/g) || []).map(Number);
      T_('Vacancies').insert({
        id: id, company: r[1], department: r[2], hiringManager: r[3], recruiterId: rec.id, title: String(r[5]).trim(), headcount: 1,
        salaryMin: nums.length ? nums[0] : '', salaryMax: nums.length ? nums[nums.length - 1] : '', difficulty: 'Orta', priority: 'Normal', minScore: '',
        openedAt: opened, deadline: oldDate(r[7]), status: 'Açıq', pausedSince: '', pausedDays: 0, closedAt: '', note: r[8] || '',
        createdAt: nowIso_(), createdBy: ctx.user.id, updatedAt: nowIso_()
      });
      vacByTitle[String(r[5]).trim().toLowerCase() + '|' + String(r[1]).trim().toLowerCase()] = id;
      log.push('Vakansiya: ' + r[5] + ' → ' + id);
    });
  }

  // Müsahibələr
  var msh = ss.getSheetByName('Müsahibələr bazası');
  if (msh && msh.getLastRow() > 1) {
    msh.getRange(2, 1, msh.getLastRow() - 1, 24).getValues().forEach(function (r) {
      var candName = String(r[8] || '').trim();
      if (!candName || !r[5]) return;
      var key = String(r[5]).trim().toLowerCase() + '|' + String(r[1]).trim().toLowerCase();
      var vid = vacByTitle[key];
      var rec = userByName(String(r[3]).split(/[;,]/)[0]);
      if (!vid) {
        vid = T_('Vacancies').nextId();
        T_('Vacancies').insert({ id: vid, company: r[1], department: '', hiringManager: String(r[4] || '').split(/[;,]/)[0], recruiterId: rec.id, title: String(r[5]).trim(), headcount: 1, salaryMin: '', salaryMax: firstNum(r[6]), difficulty: 'Orta', priority: 'Normal', minScore: '', openedAt: oldDate(r[11]) || todayStr_(), deadline: '', status: 'Açıq', pausedSince: '', pausedDays: 0, closedAt: '', note: 'Köhnə müsahibə bazasından yaradıldı', createdAt: nowIso_(), createdBy: ctx.user.id, updatedAt: nowIso_() });
        vacByTitle[key] = vid;
        log.push('Vakansiya (müsahibədən): ' + r[5] + ' → ' + vid);
      }
      var cand = T_('Candidates').find(function (c) { return c.fullName.trim().toLowerCase() === candName.toLowerCase(); });
      if (!cand) {
        var cid = T_('Candidates').nextId();
        cand = T_('Candidates').insert({ id: cid, fullName: candName, phone: '', email: '', cvUrl: '', source: r[13] || '', sourceNote: r[14] || '', salaryExpectation: firstNum(r[7]), note: '', createdAt: nowIso_(), createdBy: ctx.user.id });
      }
      var app = T_('Applications').find(function (a) { return a.vacancyId === vid && a.candidateId === cand.id; });
      var mDate = oldDate(r[11]);
      var now = nowIso_();
      if (!app) {
        var hiredStatus = String(r[22] || '');
        var stage = /qəbul edildi/i.test(hiredStatus) ? 'İşə qəbul' : (/uyğun görülmədi/i.test(hiredStatus) || r[20] === 'Bəyənilmədi' || r[15] === 'İştirak etməyib') ? 'İmtina' : 'Müsahibə';
        var hireDate = oldDate(r[23]);
        var aid = T_('Applications').nextId();
        app = T_('Applications').insert({
          id: aid, vacancyId: vid, candidateId: cand.id, recruiterId: rec.id, stage: stage, stageChangedAt: now,
          stageHistory: JSON.stringify([{ stage: 'Müsahibə', at: now, by: ctx.user.id }].concat(stage !== 'Müsahibə' ? [{ stage: stage, at: now, by: ctx.user.id }] : [])),
          rejectBy: stage === 'İmtina' ? (r[15] === 'İştirak etməyib' ? 'Namizəd' : 'Biz') : '',
          rejectReason: stage === 'İmtina' ? (r[15] === 'İştirak etməyib' ? 'Əlaqə saxlamadı' : 'Peşəkar bilik kifayət deyil') : '',
          offerDate: stage === 'İşə qəbul' ? (hireDate || mDate) : '', offerSalary: stage === 'İşə qəbul' ? firstNum(r[7]) : '',
          offerResponse: stage === 'İşə qəbul' ? 'Qəbul etdi' : '', offerResponseDate: stage === 'İşə qəbul' ? (hireDate || mDate) : '',
          offerDeclineReason: '', hireDate: stage === 'İşə qəbul' ? (hireDate || mDate) : '',
          probationEnd: stage === 'İşə qəbul' && (hireDate || mDate) ? addMonths_(hireDate || mDate, 3) : '', probationResult: '', probationNote: '',
          createdAt: now, updatedAt: now
        });
      }
      var mid = T_('Interviews').nextId();
      T_('Interviews').insert({
        id: mid, applicationId: app.id, vacancyId: vid, candidateId: cand.id, recruiterId: rec.id,
        type: r[2], format: r[17], date: mDate, startTime: oldTime(r[12]), endTime: oldTime(r[18]),
        participantsHR: r[3], participantsManagers: r[4], taskType: r[9], taskResult: r[10],
        attendance: r[15], absenceReason: r[16] || (r[15] === 'İştirak etməyib' ? 'Digər' : ''), comment: r[19], result: r[20],
        createdAt: now, resultEnteredAt: r[15] ? (oldDate(r[21]) || now) : '', createdBy: ctx.user.id
      });
      log.push('Müsahibə: ' + candName + ' → ' + mid);
    });
  }
  var msg = 'Köçürmə tamamlandı.\n' + log.join('\n');
  Logger.log(msg);
  return msg;
}
