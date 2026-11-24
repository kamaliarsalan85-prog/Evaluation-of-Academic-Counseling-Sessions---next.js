import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatJalaliDate,
  formatJalaliDateTime,
  getTehranPeriodBounds,
  parseFlexibleDateRangeBound,
  toPersianDigits,
} from '../jalali';
import { hashPassword, verifyPassword } from '../password';
import { checkRateLimit, resetRateLimitForTests } from '../rate-limit';
import { validatePublicSubmission, type QuestionRule } from '../validation';
import { buildCsvExport, buildXlsxExport } from '../export';
import { getDatabaseConfigErrorMessage, inspectDatabaseUrlStatus } from '../prisma';
import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  extractBearerToken,
  isHttpsRequest,
  verifyRequestOriginAndCsrf,
  type AuthenticatedAdmin,
} from '../auth';

test('Jalali formatting & Tehran boundaries handle Persian digits and dates accurately', () => {
  assert.equal(toPersianDigits('1405/09/02'), '۱۴۰۵/۰۹/۰۲');
  // 2026-11-23T12:00:00Z = 1405/09/02 15:30 in Tehran
  const sampleDate = new Date('2026-11-23T12:00:00.000Z');
  assert.equal(formatJalaliDate(sampleDate, false), '1405/09/02');
  assert.equal(formatJalaliDateTime(sampleDate, false), '1405/09/02 - 15:30');

  const bounds = getTehranPeriodBounds(sampleDate);
  assert.ok(bounds.todayStart < sampleDate);
  assert.ok(bounds.weekStart <= bounds.todayStart);
  assert.ok(bounds.monthStart <= bounds.todayStart);

  const startJalali = parseFlexibleDateRangeBound('۱۴۰۵/۰۹/۰۲', 'start');
  const endJalali = parseFlexibleDateRangeBound('1405/09/02', 'end');
  assert.ok(startJalali && endJalali);
  assert.ok(startJalali < sampleDate && sampleDate < endJalali);
});

test('scrypt password hashing verifies correct password and rejects invalid ones', async () => {
  const hash = await hashPassword('StrongPass!1405');
  assert.ok(hash.startsWith('scrypt$'));
  assert.equal(await verifyPassword('StrongPass!1405', hash), true);
  assert.equal(await verifyPassword('WrongPass!1405', hash), false);
});

test('sliding window rate limiter enforces threshold and resets cleanly', () => {
  resetRateLimitForTests();
  const key = 'test-ip';
  assert.equal(checkRateLimit(key, 2, 60_000, 1000).allowed, true);
  assert.equal(checkRateLimit(key, 2, 60_000, 2000).allowed, true);
  const blocked = checkRateLimit(key, 2, 60_000, 3000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1);

  // After window passes, allowed again
  assert.equal(checkRateLimit(key, 2, 60_000, 70_000).allowed, true);
});

test('public submission validation validates all 5 question types and rejects tampered option IDs', () => {
  const questions: QuestionRule[] = [
    {
      id: 'q1',
      questionText: 'امتیاز جلسه',
      questionType: 'RATING',
      isRequired: true,
      isActive: true,
      displayOrder: 0,
      config: { minRating: 1, maxRating: 5 },
      options: [],
    },
    {
      id: 'q2',
      questionText: 'کیفیت برنامه',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      isActive: true,
      displayOrder: 1,
      config: null,
      options: [
        { id: 'opt1', optionText: 'عالی', displayOrder: 0 },
        { id: 'opt2', optionText: 'متوسط', displayOrder: 1 },
      ],
    },
    {
      id: 'q3',
      questionText: 'محورهای جلسه',
      questionType: 'MULTIPLE_CHOICE',
      isRequired: false,
      isActive: true,
      displayOrder: 2,
      config: null,
      options: [
        { id: 'opt3', optionText: 'برنامه‌ریزی', displayOrder: 0 },
        { id: 'opt4', optionText: 'انگیزه', displayOrder: 1 },
      ],
    },
    {
      id: 'q4',
      questionText: 'نظم برگزاری',
      questionType: 'YES_NO',
      isRequired: true,
      isActive: true,
      displayOrder: 3,
      config: { yesLabel: 'بله', noLabel: 'خیر' },
      options: [],
    },
    {
      id: 'q5',
      questionText: 'توضیحات',
      questionType: 'DESCRIPTIVE',
      isRequired: false,
      isActive: true,
      displayOrder: 4,
      config: null,
      options: [],
    },
  ];

  const validCounselors = new Set(['c1']);

  // Missing required fields fails
  const invalid = validatePublicSubmission(
    {
      firstName: ' ',
      lastName: 'ا',
      counselorId: 'invalid-counselor',
      formVersionId: 'fv1',
      answers: [],
    },
    questions,
    validCounselors,
    'fv1'
  );
  assert.equal(invalid.valid, false);
  assert.ok(invalid.fieldErrors.firstName);
  assert.ok(invalid.fieldErrors.lastName);
  assert.ok(invalid.fieldErrors.counselorId);
  assert.ok(invalid.fieldErrors.question_q1);
  assert.ok(invalid.fieldErrors.question_q2);
  assert.ok(invalid.fieldErrors.question_q4);

  // Tampered option ID fails
  const tampered = validatePublicSubmission(
    {
      firstName: 'علی',
      lastName: 'احمدی',
      counselorId: 'c1',
      formVersionId: 'fv1',
      answers: [
        { questionId: 'q1', ratingValue: 5 },
        { questionId: 'q2', selectedOptionId: 'forged-option' },
        { questionId: 'q4', yesNoValue: true },
      ],
    },
    questions,
    validCounselors,
    'fv1'
  );
  assert.equal(tampered.valid, false);
  assert.ok(tampered.fieldErrors.question_q2);

  // Honeypot filled fails
  const bot = validatePublicSubmission(
    {
      firstName: 'علی',
      lastName: 'احمدی',
      counselorId: 'c1',
      formVersionId: 'fv1',
      website: 'http://spam.example',
      answers: [
        { questionId: 'q1', ratingValue: 5 },
        { questionId: 'q2', selectedOptionId: 'opt1' },
        { questionId: 'q4', yesNoValue: true },
      ],
    },
    questions,
    validCounselors,
    'fv1'
  );
  assert.equal(bot.valid, false);

  // Valid full submission passes and builds snapshots
  const ok = validatePublicSubmission(
    {
      firstName: '  زهرا  ',
      lastName: ' محمدی ',
      counselorId: 'c1',
      formVersionId: 'fv1',
      answers: [
        { questionId: 'q1', ratingValue: 4 },
        { questionId: 'q2', selectedOptionId: 'opt1' },
        { questionId: 'q3', selectedOptionIds: ['opt3', 'opt4'] },
        { questionId: 'q4', yesNoValue: true },
        { questionId: 'q5', textAnswer: 'بسیار جلسه مفیدی بود.' },
      ],
    },
    questions,
    validCounselors,
    'fv1'
  );
  assert.equal(ok.valid, true);
  assert.equal(ok.normalized?.firstName, 'زهرا');
  assert.equal(ok.normalized?.lastName, 'محمدی');
  assert.equal(ok.normalized?.answers.length, 5);
});

test('CSV and XLSX export builders neutralize formula injection and generate valid outputs', async () => {
  const sample = [
    {
      id: 'sub1',
      firstName: '=CMD()',
      lastName: 'رضایی',
      submittedAt: new Date('2026-11-23T10:00:00Z'),
      counselor: { firstName: 'سارا', lastName: 'محمدی' },
      formVersion: { versionNumber: 1 },
      answers: [
        {
          questionId: 'q1',
          answerText: '5 از 5',
          questionSnapshot: { questionText: 'رضایت کلی' },
        },
      ],
    },
  ];

  const csv = buildCsvExport(sample).toString('utf8');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes("\"'=CMD()\""));
  assert.ok(csv.includes('رضایت کلی'));

  const xlsxBuf = await buildXlsxExport(sample);
  assert.ok(xlsxBuf.length > 500);
  // ZIP magic bytes PK
  assert.equal(xlsxBuf[0], 0x50);
  assert.equal(xlsxBuf[1], 0x4b);
});

test('DATABASE_URL inspector detects missing, placeholder, bracketed password, and valid URLs', () => {
  assert.deepEqual(inspectDatabaseUrlStatus(undefined), { valid: false, issue: 'missing' });
  assert.deepEqual(
    inspectDatabaseUrlStatus('postgresql://postgres:[YOUR-DATABASE-PASSWORD]@localhost:5432/postgres'),
    { valid: false, issue: 'placeholder' }
  );
  assert.deepEqual(
    inspectDatabaseUrlStatus('postgresql://postgres:%5BmyPass123%5D@localhost:5432/postgres'),
    { valid: false, issue: 'bracketed_password' }
  );
  assert.deepEqual(
    inspectDatabaseUrlStatus('postgresql://postgres:myPass123@localhost:5432/postgres'),
    { valid: true }
  );
  assert.ok(getDatabaseConfigErrorMessage('bracketed_password').includes('براکت'));
});

test('auth cookie attributes and CSRF/origin verification handle local HTTP and HTTPS iframe proxies', () => {
  // Local plain HTTP request -> SameSite=lax without Secure
  const localReq = new NextRequest('http://127.0.0.1:3000/api/auth/login', {
    headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' },
  });
  assert.equal(isHttpsRequest(localReq), false);
  const localRes = NextResponse.json({ ok: true });
  attachSessionCookie(localRes, 'tok123', new Date(Date.now() + 60_000), localReq);
  const localCookie = localRes.headers.get('set-cookie') || '';
  assert.ok(localCookie.toLowerCase().includes('samesite=lax'));
  assert.equal(localCookie.includes('Secure'), false);

  // Proxied HTTPS iframe request (even if internal hop sends x-forwarded-proto: http and host: localhost:3000)
  const iframeReq = new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      'x-forwarded-proto': 'http',
      origin: 'https://ais-dev-example.run.app',
      'x-csrf-token': 'csrf123',
    },
  });
  assert.equal(isHttpsRequest(iframeReq), true);
  const iframeRes = NextResponse.json({ ok: true });
  attachSessionCookie(iframeRes, 'tok123', new Date(Date.now() + 60_000), iframeReq);
  const iframeCookie = iframeRes.headers.get('set-cookie') || '';
  assert.ok(iframeCookie.toLowerCase().includes('samesite=none'));
  assert.ok(iframeCookie.includes('Secure'));
  assert.ok(iframeCookie.includes('Partitioned'));

  // verifyRequestOriginAndCsrf allows matching APP_URL host even if proxy host is localhost:3000
  const prevAppUrl = process.env.APP_URL;
  process.env.APP_URL = 'https://ais-dev-example.run.app';
  try {
    const dummyAdmin: AuthenticatedAdmin = {
      id: 'a1',
      username: 'u1',
      fullName: 'مدیر',
      role: 'SUPER_ADMIN',
      permissions: [],
      sessionId: 's1',
      csrfToken: 'csrf123',
    };
    assert.equal(verifyRequestOriginAndCsrf(iframeReq, dummyAdmin), true);
  } finally {
    process.env.APP_URL = prevAppUrl;
  }

  assert.equal(extractBearerToken('Bearer abc123'), 'abc123');
  assert.equal(extractBearerToken('bearer  xyz_token '), 'xyz_token');
  assert.equal(extractBearerToken('Bearer   '), null);
  assert.equal(extractBearerToken('Basic abc123'), null);
  assert.equal(extractBearerToken(null), null);
});
