import { isValidJalaaliDate, toGregorian, toJalaali } from 'jalaali-js';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function getTehranParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekdayIndex: number; // 0 = Saturday .. 6 = Friday
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  const weekdayMap: Record<string, number> = {
    Sat: 0,
    Sun: 1,
    Mon: 2,
    Tue: 3,
    Wed: 4,
    Thu: 5,
    Fri: 6,
  };

  const hourRaw = Number(get('hour'));
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: hourRaw === 24 ? 0 : hourRaw,
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekdayIndex: weekdayMap[get('weekday')] ?? 0,
  };
}

const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatJalaliDate(dateInput: Date | string, usePersianDigits = true): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return '—';
  const tehran = getTehranParts(date);
  const j = toJalaali(tehran.year, tehran.month, tehran.day);
  const formatted = `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`;
  return usePersianDigits ? toPersianDigits(formatted) : formatted;
}

export function formatJalaliDateLong(dateInput: Date | string, usePersianDigits = true): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return '—';
  const tehran = getTehranParts(date);
  const j = toJalaali(tehran.year, tehran.month, tehran.day);
  const monthName = JALALI_MONTHS[j.jm - 1] ?? '';
  const formatted = `${j.jd} ${monthName} ${j.jy}`;
  return usePersianDigits ? toPersianDigits(formatted) : formatted;
}

export function formatJalaliDateTime(dateInput: Date | string, usePersianDigits = true): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return '—';
  const tehran = getTehranParts(date);
  const j = toJalaali(tehran.year, tehran.month, tehran.day);
  const formatted = `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)} - ${pad2(tehran.hour)}:${pad2(tehran.minute)}`;
  return usePersianDigits ? toPersianDigits(formatted) : formatted;
}

/**
 * Converts a Tehran local wall-clock date/time to UTC Date.
 * Iran Standard Time is UTC+3:30 year-round (since DST abolition in 2022/1401).
 * To stay accurate regardless of host TZ, we verify against Intl Asia/Tehran offset.
 */
export function tehranWallClockToUtc(
  gy: number,
  gm: number,
  gd: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
): Date {
  // Initial guess using +03:30
  const approxUtcMs = Date.UTC(gy, gm - 1, gd, hour, minute, second, ms) - 210 * 60 * 1000;
  const probe = new Date(approxUtcMs);
  const tehran = getTehranParts(probe);
  const actualLocalMs = Date.UTC(
    tehran.year,
    tehran.month - 1,
    tehran.day,
    tehran.hour,
    tehran.minute,
    tehran.second,
    0
  );
  const targetLocalMs = Date.UTC(gy, gm - 1, gd, hour, minute, second, 0);
  const diff = targetLocalMs - actualLocalMs;
  return new Date(approxUtcMs + diff);
}

/**
 * Parses either a Jalali date string ("1405/09/02" or "1405-09-02") or
 * Gregorian ISO date string ("2026-11-23") into UTC start/end of that Tehran day.
 */
export function parseFlexibleDateRangeBound(
  raw: string | null | undefined,
  bound: 'start' | 'end'
): Date | null {
  if (!raw) return null;
  const cleaned = toEnglishDigits(raw.trim()).replace(/\//g, '-');
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(cleaned);
  if (!match) return null;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);

  let gy = y;
  let gm = m;
  let gd = d;

  // Years below 1700 are Jalali
  if (y < 1700) {
    if (!isValidJalaaliDate(y, m, d)) return null;
    const g = toGregorian(y, m, d);
    gy = g.gy;
    gm = g.gm;
    gd = g.gd;
  }

  return bound === 'start'
    ? tehranWallClockToUtc(gy, gm, gd, 0, 0, 0, 0)
    : tehranWallClockToUtc(gy, gm, gd, 23, 59, 59, 999);
}

export function getTehranPeriodBounds(now = new Date()): {
  todayStart: Date;
  weekStart: Date;
  monthStart: Date;
} {
  const tehran = getTehranParts(now);
  const todayStart = tehranWallClockToUtc(tehran.year, tehran.month, tehran.day, 0, 0, 0, 0);

  // Start of week (Saturday in Iran)
  const weekStart = new Date(todayStart.getTime() - tehran.weekdayIndex * 24 * 60 * 60 * 1000);

  // Start of Jalali month
  const jNow = toJalaali(tehran.year, tehran.month, tehran.day);
  const gMonthStart = toGregorian(jNow.jy, jNow.jm, 1);
  const monthStart = tehranWallClockToUtc(
    gMonthStart.gy,
    gMonthStart.gm,
    gMonthStart.gd,
    0,
    0,
    0,
    0
  );

  return { todayStart, weekStart, monthStart };
}

export function getTehranDayKey(date: Date): string {
  const tehran = getTehranParts(date);
  const j = toJalaali(tehran.year, tehran.month, tehran.day);
  return `${j.jy}-${pad2(j.jm)}-${pad2(j.jd)}`;
}
