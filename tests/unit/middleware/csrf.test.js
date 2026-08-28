const { attachCsrfToken, verifyCsrfToken } = require('../../../src/middleware/csrf');

function makeReq({ method = 'POST', path = '/api/auth/login', session = {}, header = {}, body = {}, contentType = 'application/json' } = {}) {
  return {
    method,
    path,
    session,
    body,
    header: (name) => header[name],
    is: (type) => (contentType && contentType.includes(type) ? type : false),
  };
}

function makeRes() {
  return {
    locals: { t: (key) => key, lang: 'en' },
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    render: jest.fn().mockReturnThis(),
  };
}

describe('attachCsrfToken', () => {
  test('generate token baru kalau session belum punya', () => {
    const req = { session: {} };
    const res = makeRes();
    attachCsrfToken(req, res, jest.fn());
    expect(req.session.csrfToken).toBeDefined();
    expect(req.session.csrfToken).toHaveLength(64);
    expect(res.locals.csrfToken).toBe(req.session.csrfToken);
  });

  test('TIDAK generate ulang kalau session sudah punya token (token stabil selama sesi)', () => {
    const req = { session: { csrfToken: 'existing-token-12345' } };
    const res = makeRes();
    attachCsrfToken(req, res, jest.fn());
    expect(req.session.csrfToken).toBe('existing-token-12345');
  });

  test('tidak error kalau req.session tidak ada (belum lewat session middleware)', () => {
    const req = {};
    const res = makeRes();
    const next = jest.fn();
    expect(() => attachCsrfToken(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalled();
  });
});

describe('verifyCsrfToken', () => {
  test('method GET/HEAD/OPTIONS selalu lolos tanpa cek token sama sekali (safe methods)', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      const req = makeReq({ method, session: {} });
      const res = makeRes();
      const next = jest.fn();
      verifyCsrfToken(req, res, next);
      expect(next).toHaveBeenCalled();
    }
  });

  test('POST tanpa token sama sekali ditolak 403', () => {
    const req = makeReq({ method: 'POST', session: { csrfToken: 'valid-token' } });
    const res = makeRes();
    const next = jest.fn();
    verifyCsrfToken(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('POST dengan token yang SALAH ditolak 403', () => {
    const req = makeReq({
      method: 'POST',
      session: { csrfToken: 'token-yang-benar' },
      header: { 'X-CSRF-Token': 'token-yang-salah' },
    });
    const res = makeRes();
    const next = jest.fn();
    verifyCsrfToken(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('POST dengan token yang BENAR (dari header X-CSRF-Token) lolos', () => {
    const req = makeReq({
      method: 'POST',
      session: { csrfToken: 'token-cocok' },
      header: { 'X-CSRF-Token': 'token-cocok' },
    });
    const res = makeRes();
    const next = jest.fn();
    verifyCsrfToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('POST dengan token yang BENAR (dari body._csrf, form HTML biasa) lolos', () => {
    const req = makeReq({
      method: 'POST',
      session: { csrfToken: 'token-cocok' },
      body: { _csrf: 'token-cocok' },
    });
    const res = makeRes();
    const next = jest.fn();
    verifyCsrfToken(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('API Gateway (/api/v1/*) SELALU lolos tanpa cek CSRF sama sekali - pakai API key, bukan session', () => {
    const req = makeReq({ method: 'POST', path: '/api/v1/students', session: {} });
    const res = makeRes();
    const next = jest.fn();
    verifyCsrfToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('kegagalan CSRF pada request JSON (fetch/AJAX) mengembalikan JSON, bukan render halaman HTML', () => {
    const req = makeReq({ method: 'POST', path: '/admin/instances/1/destroy', session: { csrfToken: 'a' }, contentType: 'application/json' });
    const res = makeRes();
    verifyCsrfToken(req, res, jest.fn());
    expect(res.json).toHaveBeenCalled();
    expect(res.render).not.toHaveBeenCalled();
  });

  test('kegagalan CSRF pada request form HTML biasa (bukan JSON) me-render halaman error, bukan JSON', () => {
    const req = makeReq({ method: 'POST', path: '/admin/login', session: { csrfToken: 'a' }, contentType: 'application/x-www-form-urlencoded' });
    const res = makeRes();
    verifyCsrfToken(req, res, jest.fn());
    expect(res.render).toHaveBeenCalledWith('errors/403', expect.any(Object));
    expect(res.json).not.toHaveBeenCalled();
  });
});
