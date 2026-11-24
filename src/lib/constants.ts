export const ALL_PERMISSIONS = [
  'VIEW_DASHBOARD',
  'VIEW_SUBMISSIONS',
  'SEARCH_SUBMISSIONS',
  'VIEW_SUBMISSION_DETAILS',
  'EDIT_SUBMISSIONS',
  'DELETE_SUBMISSIONS',
  'EXPORT_REPORTS',
  'VIEW_ANALYTICS',
  'MANAGE_COUNSELORS',
  'MANAGE_QUESTIONS',
  'PUBLISH_FORM_VERSIONS',
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, { title: string; description: string }> = {
  VIEW_DASHBOARD: {
    title: 'مشاهده داشبورد',
    description: 'دسترسی به نمای کلی آمار و گزارش‌های لحظه‌ای',
  },
  VIEW_SUBMISSIONS: {
    title: 'مشاهده ارزیابی‌ها',
    description: 'مشاهده فهرست ارزیابی‌های ثبت‌شده',
  },
  SEARCH_SUBMISSIONS: {
    title: 'جستجو و فیلتر ارزیابی‌ها',
    description: 'فیلتر کردن بر اساس نام دانش‌آموز، مشاور و تاریخ',
  },
  VIEW_SUBMISSION_DETAILS: {
    title: 'مشاهده جزئیات ارزیابی',
    description: 'باز کردن صفحه کامل پاسخ‌های ثبت‌شده',
  },
  EDIT_SUBMISSIONS: {
    title: 'ویرایش ارزیابی‌ها',
    description: 'اصلاح نام دانش‌آموز یا مشاور در موارد مجاز',
  },
  DELETE_SUBMISSIONS: {
    title: 'حذف ارزیابی‌ها',
    description: 'حذف رکورد ارزیابی همراه با ثبت در گزارش وقایع',
  },
  EXPORT_REPORTS: {
    title: 'خروجی اکسل و CSV',
    description: 'دریافت خروجی فیلترشده فایل‌های اکسل و CSV',
  },
  VIEW_ANALYTICS: {
    title: 'مشاهده تحلیل‌ها و نمودارها',
    description: 'دسترسی به آمار تجمیعی سوالات و عملکرد مشاوران',
  },
  MANAGE_COUNSELORS: {
    title: 'مدیریت مشاوران',
    description: 'افزودن، ویرایش و فعال/غیرفعال‌سازی مشاوران',
  },
  MANAGE_QUESTIONS: {
    title: 'مدیریت سوالات فرم',
    description: 'ویرایش پیش‌نویس سوالات و گزینه‌های ارزیابی',
  },
  PUBLISH_FORM_VERSIONS: {
    title: 'انتشار نسخه جدید فرم',
    description: 'انتشار نهایی نسخه پیش‌نویس برای استفاده عمومی',
  },
};

export const QUESTION_TYPE_LABELS: Record<
  'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'DESCRIPTIVE' | 'RATING' | 'YES_NO',
  string
> = {
  SINGLE_CHOICE: 'تک‌انتخابی',
  MULTIPLE_CHOICE: 'چندانتخابی',
  DESCRIPTIVE: 'تشریحی',
  RATING: 'امتیازی',
  YES_NO: 'بله / خیر',
};

export const DEFAULT_APP_SETTINGS = {
  id: 'default',
  institutionName: 'مرکز مشاوره و هدایت تحصیلی',
  appTitle: 'ارزیابی جلسه مشاوره حضوری',
  appDescription:
    'با ثبت دیدگاه خود پس از جلسه مشاوره، به بهبود کیفیت خدمات هدایت تحصیلی و برنامه‌ریزی کمک کنید.',
  successMessage: 'پاسخهای شما با موفقیت ثبت شد.',
  privacyNotice:
    'نام و نام خانوادگی شما صرفاً برای انطباق کیفیت خدمات و پیگیری داخلی مرکز مشاوره ثبت می‌شود و در اختیار اشخاص ثالث قرار نمی‌گیرد.',
  isFormAvailable: true,
  isPublicSubmissionEnabled: true,
  timezone: 'Asia/Tehran',
};

export const SESSION_COOKIE_NAME = 'ce_admin_session';
export const SESSION_TTL_HOURS = 12;
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
