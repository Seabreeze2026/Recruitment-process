// Google Apps Script mühitinin lokal simulyasiyası (yalnız test üçün)
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const path = require('path');

function createSheet(name) {
  let data = []; // 2D array
  let maxRows = 1000, maxCols = 26;
  const sh = {
    _data: () => data,
    getName: () => name,
    getMaxColumns: () => maxCols,
    getMaxRows: () => maxRows,
    insertColumnsAfter: (a, n) => { maxCols += n; },
    setFrozenRows: () => {},
    getLastRow: () => {
      for (let i = data.length - 1; i >= 0; i--) if (data[i] && data[i].some(v => v !== '' && v != null)) return i + 1;
      return 0;
    },
    appendRow: (vals) => { data[sh.getLastRow()] = vals.map(v => (v == null ? '' : v)); },
    deleteRow: (r) => { data.splice(r - 1, 1); },
    getRange: (r, c, nr = 1, nc = 1) => {
      const rng = {
        setNumberFormat: () => rng, setFontWeight: () => rng, setBackground: () => rng,
        setValues: (vals) => {
          for (let i = 0; i < nr; i++) {
            data[r - 1 + i] = data[r - 1 + i] || [];
            for (let j = 0; j < nc; j++) data[r - 1 + i][c - 1 + j] = vals[i][j];
          }
          return rng;
        },
        getValues: () => {
          const out = [];
          for (let i = 0; i < nr; i++) {
            const row = [];
            for (let j = 0; j < nc; j++) { const v = (data[r - 1 + i] || [])[c - 1 + j]; row.push(v == null ? '' : v); }
            out.push(row);
          }
          return out;
        }
      };
      return rng;
    }
  };
  return sh;
}

function createEnv() {
  const sheets = {};
  const cache = new Map();
  const logs = [];
  const ss = {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = createSheet(n)),
    _sheets: sheets
  };
  const fmt = (d, tz, pattern) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: tz || 'Asia/Baku', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(d).map(p => [p.type, p.value]));
    return pattern.replace('yyyy', parts.year).replace('MM', parts.month).replace('dd', parts.day).replace('HH', parts.hour === '24' ? '00' : parts.hour).replace('mm', parts.minute);
  };
  const sandbox = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getActive: () => ss, getUi: () => { throw new Error('no ui'); } },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      computeDigest: (alg, str) => Array.from(crypto.createHash('sha256').update(str, 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      formatDate: fmt
    },
    Session: { getScriptTimeZone: () => 'Asia/Baku' },
    CacheService: { getScriptCache: () => ({ get: k => cache.get(k) || null, put: (k, v) => cache.set(k, v), remove: k => cache.delete(k) }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: { createTextOutput: (s) => ({ _s: s, setMimeType() { return this; }, getContent() { return this._s; } }), MimeType: { JSON: 'json' } },
    Logger: { log: (m) => logs.push(String(m)) }
  };
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Platforma.gs'), 'utf8');
  vm.runInContext(code, sandbox, { filename: 'Platforma.gs' });
  const call = (action, data, token) => {
    const out = sandbox.doPost({ postData: { contents: JSON.stringify({ action, data, token }) } });
    return JSON.parse(out.getContent());
  };
  return { sandbox, ss, logs, call, cache };
}

module.exports = { createEnv };
