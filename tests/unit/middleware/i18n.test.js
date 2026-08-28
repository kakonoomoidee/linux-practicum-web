const i18nMiddleware = require('../../../src/middleware/i18n');

function makeReq({ query = {}, cookies = {} } = {}) {
  return { query, cookies };
}

function makeRes() {
  return { locals: {}, cookie: jest.fn() };
}

describe('i18nMiddleware', () => {
  test('default ke English kalau tidak ada query param maupun cookie', () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();
    i18nMiddleware(req, res, next);
    expect(res.locals.lang).toBe('en');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('pakai bahasa dari cookie kalau ada dan valid', () => {
    const req = makeReq({ cookies: { lang: 'id' } });
    const res = makeRes();
    i18nMiddleware(req, res, jest.fn());
    expect(res.locals.lang).toBe('id');
  });

  test('query param ?lang= MENANG dibanding cookie, dan menyimpan cookie baru', () => {
    const req = makeReq({ query: { lang: 'id' }, cookies: { lang: 'en' } });
    const res = makeRes();
    i18nMiddleware(req, res, jest.fn());
    expect(res.locals.lang).toBe('id');
    expect(res.cookie).toHaveBeenCalledWith('lang', 'id', expect.objectContaining({ sameSite: 'lax' }));
  });

  test('bahasa tidak valid (bukan en/id) di query param diabaikan, fallback ke cookie/default', () => {
    const req = makeReq({ query: { lang: 'fr' }, cookies: { lang: 'id' } });
    const res = makeRes();
    i18nMiddleware(req, res, jest.fn());
    expect(res.locals.lang).toBe('id');
    expect(res.cookie).not.toHaveBeenCalled();
  });

  test('bahasa tidak valid di cookie diabaikan, fallback ke default English', () => {
    const req = makeReq({ cookies: { lang: 'zz' } });
    const res = makeRes();
    i18nMiddleware(req, res, jest.fn());
    expect(res.locals.lang).toBe('en');
  });

  test('res.locals.t() mengembalikan teks sesuai bahasa yang aktif', () => {
    const req = makeReq({ query: { lang: 'id' } });
    const res = makeRes();
    i18nMiddleware(req, res, jest.fn());
    expect(res.locals.t('common.logout')).toBe('Keluar');
  });

  test('res.locals.t() fallback ke English kalau key tidak ada di bahasa yang dipilih', () => {
    const req = makeReq({ query: { lang: 'id' } });
    const res = makeRes();
    i18nMiddleware(req, res, jest.fn());
    expect(res.locals.t('namespace.keyYangGaAda')).toBe('namespace.keyYangGaAda');
  });

  test('res.locals.t() melakukan interpolasi variable {var}', () => {
    const req = makeReq();
    const res = makeRes();
    i18nMiddleware(req, res, jest.fn());
    const result = res.locals.t('dashboard.noContainerSubtitle', { ttl: 24 });
    expect(result).toContain('24');
    expect(result).not.toContain('{ttl}');
  });
});
