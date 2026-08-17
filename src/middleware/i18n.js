const en = require('../i18n/en.json');
const id = require('../i18n/id.json');

const dictionaries = { en, id };
const DEFAULT_LANG = 'en';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 tahun

function getNested(obj, keyPath) {
  return keyPath.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function interpolate(str, vars) {
  if (!vars || typeof str !== 'string') return str;
  return str.replace(/\{(\w+)\}/g, (match, key) => (vars[key] !== undefined ? String(vars[key]) : match));
}

/**
 * Middleware i18n sederhana - tanpa dependency library i18n eksternal.
 *
 * Prioritas penentuan bahasa:
 * 1. Query param ?lang=en atau ?lang=id (dari toggle di navbar) - kalau valid, disimpan ke cookie
 * 2. Cookie "lang" dari kunjungan sebelumnya
 * 3. Default: English ("en")
 *
 * Menyediakan res.locals.t(key, vars) yang bisa dipanggil langsung di EJS,
 * dengan fallback otomatis ke English kalau key tidak ada di bahasa yang dipilih.
 */
function i18nMiddleware(req, res, next) {
  let lang = req.query.lang;

  if (lang && dictionaries[lang]) {
    res.cookie('lang', lang, { maxAge: COOKIE_MAX_AGE, httpOnly: false, sameSite: 'lax' });
  } else {
    lang = (req.cookies && req.cookies.lang) || DEFAULT_LANG;
    if (!dictionaries[lang]) lang = DEFAULT_LANG;
  }

  const dict = dictionaries[lang];
  const fallbackDict = dictionaries[DEFAULT_LANG];

  req.lang = lang;
  res.locals.lang = lang;
  res.locals.t = (key, vars) => {
    const value = getNested(dict, key) ?? getNested(fallbackDict, key) ?? key;
    return interpolate(value, vars);
  };

  next();
}

module.exports = i18nMiddleware;
