'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
  AlertCircle,
  RotateCcw,
  ChevronDown,
  Lock,
} from 'lucide-react';
import { QuestionField, type PublicQuestionItem, type QuestionAnswerState } from './QuestionField';
import { PWAInstallButton } from '@/components/pwa/PwaSupport';
import { useToast } from '@/components/ui/ToastProvider';
import { formatJalaliDateTime, toPersianDigits } from '@/lib/jalali';

export interface PublicFormPayload {
  settings: {
    institutionName: string;
    appTitle: string;
    appDescription: string;
    successMessage: string;
    privacyNotice: string;
    isFormAvailable: boolean;
    isPublicSubmissionEnabled: boolean;
    timezone: string;
  };
  counselors: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
  formVersion: {
    id: string;
    versionNumber: number;
    questions: PublicQuestionItem[];
  } | null;
}

export function PublicEvaluationClient({
  initialData,
  dbError = null,
}: {
  initialData: PublicFormPayload;
  dbError?: string | null;
}) {
  const toast = useToast();
  const [formData, setFormData] = useState<PublicFormPayload>(initialData);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [counselorId, setCounselorId] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot
  const [answers, setAnswers] = useState<Record<string, QuestionAnswerState>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{
    message: string;
    submittedAt: string;
  } | null>(null);

  const { settings, counselors, formVersion } = formData;
  const isClosed = !settings.isFormAvailable || !settings.isPublicSubmissionEnabled || !formVersion;

  const handleAnswerChange = (questionId: string, next: QuestionAnswerState) => {
    setAnswers((prev) => ({ ...prev, [questionId]: next }));
    setFieldErrors((prev) => {
      const key = `question_${questionId}`;
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const validateClientSide = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (firstName.trim().length < 2) {
      errors.firstName = 'لطفاً نام خود را وارد کنید (حداقل ۲ حرف).';
    }
    if (lastName.trim().length < 2) {
      errors.lastName = 'لطفاً نام خانوادگی خود را وارد کنید (حداقل ۲ حرف).';
    }
    if (!counselorId) {
      errors.counselorId = 'انتخاب نام مشاور الزامی است.';
    }

    if (formVersion) {
      for (const q of formVersion.questions) {
        if (!q.isRequired) continue;
        const val = answers[q.id];
        const key = `question_${q.id}`;
        if (q.questionType === 'SINGLE_CHOICE' && !val?.selectedOptionId) {
          errors[key] = 'لطفاً یکی از گزینه‌ها را انتخاب کنید.';
        } else if (
          q.questionType === 'MULTIPLE_CHOICE' &&
          (!val?.selectedOptionIds || val.selectedOptionIds.length === 0)
        ) {
          errors[key] = 'انتخاب حداقل یک گزینه الزامی است.';
        } else if (q.questionType === 'DESCRIPTIVE' && !(val?.textAnswer ?? '').trim()) {
          errors[key] = 'لطفاً پاسخ خود را بنویسید.';
        } else if (
          q.questionType === 'RATING' &&
          (val?.ratingValue === null || val?.ratingValue === undefined)
        ) {
          errors[key] = 'لطفاً امتیاز مورد نظر را انتخاب کنید.';
        } else if (
          q.questionType === 'YES_NO' &&
          (val?.yesNoValue === null || val?.yesNoValue === undefined)
        ) {
          errors[key] = 'لطفاً یکی از گزینه‌ها را انتخاب کنید.';
        }
      }
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVersion || isSubmitting) return;

    setGeneralError(null);
    const clientErrors = validateClientSide();
    if (Object.keys(clientErrors).length > 0) {
      const msg = 'برخی از فیلدهای الزامی تکمیل نشده‌اند. لطفاً موارد مشخص‌شده را بررسی کنید.';
      setFieldErrors(clientErrors);
      setGeneralError(msg);
      toast.error(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        counselorId,
        formVersionId: formVersion.id,
        website,
        answers: formVersion.questions.map((q) => {
          const val = answers[q.id] ?? {};
          return {
            questionId: q.id,
            selectedOptionId: val.selectedOptionId ?? null,
            selectedOptionIds: val.selectedOptionIds ?? [],
            textAnswer: val.textAnswer ?? null,
            ratingValue: val.ratingValue ?? null,
            yesNoValue: val.yesNoValue ?? null,
          };
        }),
      };

      const res = await fetch('/api/public/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.fieldErrors && typeof data.fieldErrors === 'object') {
          setFieldErrors(data.fieldErrors);
        }
        const errMsg = data.error || 'خطا در ثبت اطلاعات. لطفاً دوباره تلاش کنید.';
        setGeneralError(errMsg);
        toast.error(errMsg);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (res.status === 409) {
          // Refresh form version if updated while user was filling
          const refreshed = await fetch('/api/public/form', { cache: 'no-store' });
          if (refreshed.ok) {
            setFormData(await refreshed.json());
          }
        }
        return;
      }

      const okMsg = data.message || settings.successMessage || 'پاسخهای شما با موفقیت ثبت شد.';
      setSubmittedResult({
        message: okMsg,
        submittedAt: data.submittedAt || new Date().toISOString(),
      });
      setFieldErrors({});
      setGeneralError(null);
      toast.success(okMsg);
    } catch {
      const errMsg = 'ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت را بررسی کرده و دوباره تلاش کنید.';
      setGeneralError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartNew = async () => {
    setSubmittedResult(null);
    setFirstName('');
    setLastName('');
    setCounselorId('');
    setAnswers({});
    setFieldErrors({});
    setGeneralError(null);
    try {
      const refreshed = await fetch('/api/public/form', { cache: 'no-store' });
      if (refreshed.ok) {
        setFormData(await refreshed.json());
      }
    } catch {
      // keep existing form data
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F7FC]">
      {/* Top Institutional Header */}
      <header className="sticky top-0 z-30 bg-[#142B4A] text-white border-b border-white/10 pt-safe">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 sm:gap-4 px-3.5 py-3.5 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardCheck className="h-5 w-5 shrink-0 text-[#60A5FA]" aria-hidden="true" />
            <span className="truncate text-[13px] sm:text-base font-bold whitespace-nowrap">
              {settings.institutionName}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <PWAInstallButton variant="header" />
            <a
              href="/admin/login"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 text-xs font-medium text-white/85 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                <span className="hidden sm:inline">پنل </span>مدیریت
              </span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {submittedResult ? (
          <section
            aria-live="polite"
            className="rounded-2xl bg-white border border-[#E2E8F0] p-8 sm:p-10 text-center shadow-sm"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#20A36B]/10 text-[#20A36B]">
              <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
            </div>
            <h1 className="mt-5 text-xl sm:text-2xl font-bold text-[#1E293B]">
              {submittedResult.message}
            </h1>
            <p className="mt-3 text-sm leading-7 text-[#64748B]">
              از وقتی که برای ارزیابی جلسه مشاوره اختصاص دادید سپاسگزاریم. بازخورد شما در بهبود کیفیت خدمات آموزشی مؤثر خواهد بود.
            </p>
            <p className="mt-4 text-xs text-[#64748B] tabular-nums">
              زمان ثبت: {formatJalaliDateTime(submittedResult.submittedAt)}
            </p>
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={handleStartNew}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#2878D0] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1E63B3] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>ثبت ارزیابی جدید</span>
              </button>
            </div>
          </section>
        ) : dbError ? (
          <section
            role="alert"
            className="rounded-2xl bg-white border border-[#DC4444]/40 p-8 text-center shadow-sm"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DC4444]/10 text-[#DC4444]">
              <AlertCircle className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-lg font-bold text-[#1E293B]">
              اتصال به پایگاه داده برقرار نشد
            </h1>
            <p className="mt-3 text-sm leading-7 text-[#64748B]">{dbError}</p>
          </section>
        ) : isClosed ? (
          <section className="rounded-2xl bg-white border border-[#E2E8F0] p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2F7FC] text-[#142B4A]">
              <AlertCircle className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-lg font-bold text-[#1E293B]">{settings.appTitle}</h1>
            <p className="mt-3 text-sm leading-7 text-[#64748B]">
              در حال حاضر فرم ارزیابی توسط مدیریت مرکز غیرفعال شده است. لطفاً در زمان دیگری مراجعه فرمایید.
            </p>
          </section>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Title Intro Card */}
            <section className="rounded-2xl bg-white border border-[#E2E8F0] p-6 sm:p-7 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] tabular-nums">
                <span>{settings.institutionName}</span>
                <span aria-hidden="true">·</span>
                <span>نسخه فرم {toPersianDigits(formVersion.versionNumber)}</span>
                <span aria-hidden="true">·</span>
                <span>بدون نیاز به ثبت‌نام</span>
              </div>
              <h1 className="mt-2.5 text-xl sm:text-2xl font-bold text-[#142B4A] leading-snug">
                {settings.appTitle}
              </h1>
              <p className="mt-2 text-sm leading-7 text-[#64748B]">{settings.appDescription}</p>

              {/* Privacy Disclosure */}
              <div className="mt-4 border-t border-[#E2E8F0] pt-3">
                <button
                  type="button"
                  aria-expanded={showPrivacy}
                  onClick={() => setShowPrivacy((prev) => !prev)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-medium text-[#2878D0] hover:text-[#1E63B3] cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>اعلامیه حریم خصوصی و نحوه استفاده از اطلاعات</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${showPrivacy ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {showPrivacy && (
                  <p className="mt-2 rounded-xl bg-[#F2F7FC] p-3.5 text-xs leading-6 text-[#64748B]">
                    {settings.privacyNotice}
                  </p>
                )}
              </div>
            </section>

            {/* General Validation Banner */}
            {generalError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-2xl border border-[#DC4444]/40 bg-[#DC4444]/5 p-4 text-sm text-[#DC4444]"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <p className="leading-6 font-medium">{generalError}</p>
              </div>
            )}

            {/* Honeypot anti-bot field */}
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="website_field">وب‌سایت</label>
              <input
                id="website_field"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            {/* Student & Counselor Info Card */}
            <section className="rounded-2xl bg-white border border-[#E2E8F0] p-5 sm:p-6 shadow-sm space-y-5">
              <h2 className="text-base font-bold text-[#142B4A] border-b border-[#E2E8F0] pb-3">
                مشخصات جلسه و دانش‌آموز
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="student_first_name"
                    className="block text-sm font-medium text-[#1E293B] mb-1.5"
                  >
                    نام <span className="text-[#DC4444]">*</span>
                  </label>
                  <input
                    id="student_first_name"
                    name="firstName"
                    type="text"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (fieldErrors.firstName) {
                        setFieldErrors((p) => {
                          const copy = { ...p };
                          delete copy.firstName;
                          return copy;
                        });
                      }
                    }}
                    placeholder="مثال: علی"
                    className={`w-full min-h-[46px] rounded-xl border px-3.5 py-2.5 text-sm text-[#1E293B] placeholder:text-[#64748B]/70 focus:outline-none focus:ring-2 ${
                      fieldErrors.firstName
                        ? 'border-[#DC4444] focus:border-[#DC4444] focus:ring-[#DC4444]/20'
                        : 'border-[#E2E8F0] focus:border-[#2878D0] focus:ring-[#2878D0]/20'
                    }`}
                  />
                  {fieldErrors.firstName && (
                    <p className="mt-1.5 text-xs font-medium text-[#DC4444]">
                      {fieldErrors.firstName}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="student_last_name"
                    className="block text-sm font-medium text-[#1E293B] mb-1.5"
                  >
                    نام خانوادگی <span className="text-[#DC4444]">*</span>
                  </label>
                  <input
                    id="student_last_name"
                    name="lastName"
                    type="text"
                    required
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      if (fieldErrors.lastName) {
                        setFieldErrors((p) => {
                          const copy = { ...p };
                          delete copy.lastName;
                          return copy;
                        });
                      }
                    }}
                    placeholder="مثال: احمدی"
                    className={`w-full min-h-[46px] rounded-xl border px-3.5 py-2.5 text-sm text-[#1E293B] placeholder:text-[#64748B]/70 focus:outline-none focus:ring-2 ${
                      fieldErrors.lastName
                        ? 'border-[#DC4444] focus:border-[#DC4444] focus:ring-[#DC4444]/20'
                        : 'border-[#E2E8F0] focus:border-[#2878D0] focus:ring-[#2878D0]/20'
                    }`}
                  />
                  {fieldErrors.lastName && (
                    <p className="mt-1.5 text-xs font-medium text-[#DC4444]">
                      {fieldErrors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="counselor_select"
                  className="block text-sm font-medium text-[#1E293B] mb-1.5"
                >
                  نام مشاور <span className="text-[#DC4444]">*</span>
                </label>
                <select
                  id="counselor_select"
                  name="counselorId"
                  required
                  value={counselorId}
                  onChange={(e) => {
                    setCounselorId(e.target.value);
                    if (fieldErrors.counselorId) {
                      setFieldErrors((p) => {
                        const copy = { ...p };
                        delete copy.counselorId;
                        return copy;
                      });
                    }
                  }}
                  className={`w-full min-h-[46px] rounded-xl border bg-white px-3.5 py-2.5 text-sm text-[#1E293B] focus:outline-none focus:ring-2 ${
                    fieldErrors.counselorId
                      ? 'border-[#DC4444] focus:border-[#DC4444] focus:ring-[#DC4444]/20'
                      : 'border-[#E2E8F0] focus:border-[#2878D0] focus:ring-[#2878D0]/20'
                  }`}
                >
                  <option value="">-- مشاور جلسه را انتخاب کنید --</option>
                  {counselors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
                {counselors.length === 0 && (
                  <p className="mt-1.5 text-xs text-[#64748B]">
                    در حال حاضر مشاور فعالی در سیستم ثبت نشده است.
                  </p>
                )}
                {fieldErrors.counselorId && (
                  <p className="mt-1.5 text-xs font-medium text-[#DC4444]">
                    {fieldErrors.counselorId}
                  </p>
                )}
              </div>
            </section>

            {/* Dynamic Questions */}
            <div className="space-y-4">
              {formVersion.questions.map((question, idx) => (
                <QuestionField
                  key={question.id}
                  index={idx}
                  question={question}
                  value={answers[question.id] ?? {}}
                  error={fieldErrors[`question_${question.id}`]}
                  disabled={isSubmitting}
                  onChange={(next) => handleAnswerChange(question.id, next)}
                />
              ))}
            </div>

            {/* Submit Bar */}
            <div className="pt-2 pb-safe">
              <button
                type="submit"
                disabled={isSubmitting || counselors.length === 0}
                className="w-full min-h-[50px] rounded-xl bg-[#2878D0] px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-[#1E63B3] disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {isSubmitting ? 'در حال ثبت ارزیابی...' : 'ثبت نهایی ارزیابی'}
              </button>
            </div>
          </form>
        )}
      </main>

      <footer className="border-t border-[#E2E8F0] bg-white py-5 text-center text-xs text-[#64748B]">
        <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{settings.institutionName} · سامانه ارزیابی جلسات مشاوره</span>
          <div className="flex items-center gap-4">
            <PWAInstallButton variant="card" />
          </div>
        </div>
      </footer>
    </div>
  );
}
