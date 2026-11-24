'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminContext';
import { useToast } from '@/components/ui/ToastProvider';
import { PermissionDeniedCard } from '@/components/admin/AdminShell';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { QuestionField, type PublicQuestionItem } from '@/components/public/QuestionField';
import { QUESTION_TYPE_LABELS } from '@/lib/constants';
import { formatJalaliDateTime, toPersianDigits } from '@/lib/jalali';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Save,
  Rocket,
  Eye,
  X,
  AlertCircle,
  CheckCircle2,
  History,
} from 'lucide-react';

type QuestionType = keyof typeof QUESTION_TYPE_LABELS;

interface DraftQuestion {
  tempId: string;
  questionText: string;
  questionType: QuestionType;
  isRequired: boolean;
  isActive: boolean;
  config: {
    minRating?: number;
    maxRating?: number;
    yesLabel?: string;
    noLabel?: string;
  };
  options: Array<{ tempId: string; optionText: string }>;
}

interface FormVersionRecord {
  id: string;
  versionNumber: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  notes: string | null;
  publishedAt: string | null;
  _count: { submissions: number };
  questions: Array<{
    id: string;
    questionText: string;
    questionType: QuestionType;
    isRequired: boolean;
    isActive: boolean;
    displayOrder: number;
    config: DraftQuestion['config'] | null;
    options: Array<{ id: string; optionText: string; displayOrder: number }>;
  }>;
}

function makeTempId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function AdminFormsPage() {
  const { hasPermission, adminFetch } = useAdmin();
  const toast = useToast();
  const canEdit = hasPermission('MANAGE_QUESTIONS');
  const canPublish = hasPermission('PUBLISH_FORM_VERSIONS');

  const [publishedVersion, setPublishedVersion] = useState<FormVersionRecord | null>(null);
  const [draftVersion, setDraftVersion] = useState<FormVersionRecord | null>(null);
  const [archivedVersions, setArchivedVersions] = useState<FormVersionRecord[]>([]);
  const [draftNotes, setDraftNotes] = useState('');
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);

  const [activeTab, setActiveTab] = useState<'builder' | 'history'>('builder');
  const [showPreview, setShowPreview] = useState(false);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadForm = useCallback(async () => {
    if (!canEdit && !canPublish) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/forms', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'خطا در دریافت اطلاعات فرم');

      setPublishedVersion(json.publishedVersion || null);
      setDraftVersion(json.draftVersion || null);
      setArchivedVersions(json.archivedVersions || []);

      if (json.draftVersion) {
        setDraftNotes(json.draftVersion.notes || '');
        setQuestions(
          (json.draftVersion.questions || []).map((q: FormVersionRecord['questions'][number]) => ({
            tempId: q.id || makeTempId(),
            questionText: q.questionText,
            questionType: q.questionType,
            isRequired: q.isRequired,
            isActive: q.isActive,
            config: q.config || {},
            options: (q.options || []).map((o) => ({
              tempId: o.id || makeTempId(),
              optionText: o.optionText,
            })),
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در بارگذاری فرم');
    } finally {
      setLoading(false);
    }
  }, [canEdit, canPublish, adminFetch]);

  useEffect(() => {
    if (!canEdit && !canPublish) {
      setLoading(false);
      return;
    }
    loadForm();
  }, [canEdit, canPublish, loadForm]);

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        tempId: makeTempId(),
        questionText: '',
        questionType: 'SINGLE_CHOICE',
        isRequired: true,
        isActive: true,
        config: { minRating: 1, maxRating: 5, yesLabel: 'بله', noLabel: 'خیر' },
        options: [
          { tempId: makeTempId(), optionText: 'گزینه ۱' },
          { tempId: makeTempId(), optionText: 'گزینه ۲' },
        ],
      },
    ]);
  };

  const updateQuestion = (idx: number, patch: Partial<DraftQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q;
        const next = { ...q, ...patch };
        if (
          (next.questionType === 'SINGLE_CHOICE' || next.questionType === 'MULTIPLE_CHOICE') &&
          next.options.length === 0
        ) {
          next.options = [
            { tempId: makeTempId(), optionText: 'گزینه ۱' },
            { tempId: makeTempId(), optionText: 'گزینه ۲' },
          ];
        }
        return next;
      })
    );
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= questions.length) return;
    setQuestions((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveDraftInternal = async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const payload = {
        notes: draftNotes.trim() || null,
        questions: questions.map((q, idx) => ({
          questionText: q.questionText,
          questionType: q.questionType,
          isRequired: q.isRequired,
          isActive: q.isActive,
          displayOrder: idx,
          config:
            q.questionType === 'RATING'
              ? {
                  minRating: Number(q.config.minRating ?? 1),
                  maxRating: Number(q.config.maxRating ?? 5),
                }
              : q.questionType === 'YES_NO'
                ? {
                    yesLabel: q.config.yesLabel?.trim() || 'بله',
                    noLabel: q.config.noLabel?.trim() || 'خیر',
                  }
                : null,
          options:
            q.questionType === 'SINGLE_CHOICE' || q.questionType === 'MULTIPLE_CHOICE'
              ? q.options.map((opt, optIdx) => ({
                  optionText: opt.optionText,
                  displayOrder: optIdx,
                }))
              : [],
        })),
      };

      const res = await adminFetch('/api/admin/forms/draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'خطا در ذخیره پیش‌نویس');

      setDraftVersion(json.draftVersion);
      const msg = 'پیش‌نویس فرم با موفقیت ذخیره شد. (نسخه منتشرشده فعلی بدون تغییر باقی ماند)';
      setFeedback(msg);
      toast.success('پیش‌نویس فرم ذخیره شد.');
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'ذخیره پیش‌نویس انجام نشد.';
      setError(errMsg);
      toast.error(errMsg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!canPublish) return;
    setConfirmPublishOpen(false);

    if (canEdit) {
      const saved = await saveDraftInternal();
      if (!saved) return;
    }

    setPublishing(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await adminFetch('/api/admin/forms/publish', {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'خطا در انتشار نسخه جدید');

      await loadForm();
      const msg = `نسخه ${toPersianDigits(json.publishedVersion?.versionNumber ?? '')} با موفقیت منتشر شد و اکنون در فرم عمومی فعال است.`;
      setFeedback(msg);
      toast.success(msg);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'انتشار انجام نشد.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setPublishing(false);
    }
  };

  if (!canEdit && !canPublish) {
    return <PermissionDeniedCard permission="MANAGE_QUESTIONS" />;
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-[#E2E8F0] p-8 text-center text-sm text-[#64748B]">
        در حال بارگذاری ویرایشگر فرم...
      </div>
    );
  }

  const previewQuestions: PublicQuestionItem[] = questions
    .filter((q) => q.isActive && q.questionText.trim().length > 0)
    .map((q, idx) => ({
      id: q.tempId,
      questionText: q.questionText,
      questionType: q.questionType,
      isRequired: q.isRequired,
      displayOrder: idx,
      config: q.config,
      options: q.options.map((o, oIdx) => ({
        id: o.tempId,
        optionText: o.optionText,
        displayOrder: oIdx,
      })),
    }));

  const allVersions = [
    ...(publishedVersion ? [publishedVersion] : []),
    ...archivedVersions,
  ];

  return (
    <div className="space-y-6">
      {/* Top Status & Tabs */}
      <div className="rounded-2xl bg-white border border-[#E2E8F0] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] tabular-nums">
            <span>
              نسخه فعال عمومی:{' '}
              <strong className="text-[#20A36B]">
                نسخه {toPersianDigits(publishedVersion?.versionNumber ?? 0)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              پیش‌نویس در حال ویرایش:{' '}
              <strong className="text-[#142B4A]">
                نسخه {toPersianDigits(draftVersion?.versionNumber ?? 0)}
              </strong>
            </span>
          </div>
          <p className="text-xs text-[#64748B]">
            ویرایش سوالات روی پیش‌نویس اعمال می‌شود و تا زمان انتشار، پاسخ‌های ثبت‌شده قبلی دست‌نخورده باقی می‌مانند.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-[#F2F7FC] p-1 border border-[#E2E8F0]">
          <button
            type="button"
            onClick={() => setActiveTab('builder')}
            className={`min-h-[38px] rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'builder'
                ? 'bg-white text-[#142B4A] shadow-sm'
                : 'text-[#64748B] hover:text-[#142B4A]'
            }`}
          >
            ویرایشگر پیش‌نویس
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-white text-[#142B4A] shadow-sm'
                : 'text-[#64748B] hover:text-[#142B4A]'
            }`}
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            <span>تاریخچه نسخه‌ها ({toPersianDigits(allVersions.length)})</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-2xl border border-[#DC4444]/40 bg-[#DC4444]/5 p-4 text-sm text-[#DC4444]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-2xl border border-[#20A36B]/40 bg-[#20A36B]/5 p-4 text-sm text-[#20A36B]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}

      {activeTab === 'builder' ? (
        <div className="space-y-5">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {canEdit && (
                <button
                  type="button"
                  onClick={addQuestion}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[#2878D0] bg-white px-4 py-2 text-sm font-medium text-[#2878D0] hover:bg-[#F2F7FC] cursor-pointer whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>افزودن سوال جدید</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#1E293B] hover:bg-[#F2F7FC] cursor-pointer whitespace-nowrap"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                <span>پیش‌نمایش فرم</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {canEdit && (
                <button
                  type="button"
                  disabled={saving || publishing}
                  onClick={saveDraftInternal}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[#142B4A] bg-white px-4 py-2 text-sm font-medium text-[#142B4A] hover:bg-[#F2F7FC] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  <span>{saving ? 'در حال ذخیره...' : 'ذخیره پیش‌نویس'}</span>
                </button>
              )}
              {canPublish && (
                <button
                  type="button"
                  disabled={saving || publishing}
                  onClick={() => setConfirmPublishOpen(true)}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#20A36B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#198758] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                >
                  <Rocket className="h-4 w-4" aria-hidden="true" />
                  <span>{publishing ? 'در حال انتشار...' : 'انتشار نسخه جدید'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Draft Notes */}
          <div className="rounded-2xl bg-white border border-[#E2E8F0] p-5">
            <label htmlFor="draft_notes" className="block text-xs font-medium text-[#64748B] mb-1.5">
              توضیح این نسخه (داخلی)
            </label>
            <input
              id="draft_notes"
              type="text"
              disabled={!canEdit}
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              placeholder="مثال: افزودن سوال جدید درباره کیفیت برنامه‌ریزی"
              className="w-full min-h-[42px] rounded-xl border border-[#E2E8F0] px-3.5 py-2 text-sm focus:border-[#2878D0] focus:outline-none"
            />
          </div>

          {/* Questions List */}
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div
                key={q.tempId}
                className="rounded-2xl bg-white border border-[#E2E8F0] p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
                  <span className="text-sm font-bold text-[#142B4A] tabular-nums">
                    سوال {toPersianDigits(idx + 1)}
                  </span>

                  {canEdit && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`انتقال سوال ${idx + 1} به بالا`}
                        disabled={idx === 0}
                        onClick={() => moveQuestion(idx, -1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#1E293B] hover:bg-[#F2F7FC] disabled:opacity-40 cursor-pointer"
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`انتقال سوال ${idx + 1} به پایین`}
                        disabled={idx === questions.length - 1}
                        onClick={() => moveQuestion(idx, 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#1E293B] hover:bg-[#F2F7FC] disabled:opacity-40 cursor-pointer"
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`حذف سوال ${idx + 1}`}
                        onClick={() => removeQuestion(idx)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DC4444]/30 text-[#DC4444] hover:bg-[#DC4444]/5 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <label
                      htmlFor={`q_text_${q.tempId}`}
                      className="block text-xs font-medium text-[#64748B] mb-1"
                    >
                      متن سوال
                    </label>
                    <input
                      id={`q_text_${q.tempId}`}
                      type="text"
                      disabled={!canEdit}
                      value={q.questionText}
                      onChange={(e) => updateQuestion(idx, { questionText: e.target.value })}
                      placeholder="متن سوال ارزیابی را بنویسید..."
                      className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] px-3.5 py-2 text-sm focus:border-[#2878D0] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`q_type_${q.tempId}`}
                      className="block text-xs font-medium text-[#64748B] mb-1"
                    >
                      نوع پاسخ
                    </label>
                    <select
                      id={`q_type_${q.tempId}`}
                      disabled={!canEdit}
                      value={q.questionType}
                      onChange={(e) =>
                        updateQuestion(idx, { questionType: e.target.value as QuestionType })
                      }
                      className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-2 text-sm focus:border-[#2878D0] focus:outline-none"
                    >
                      {Object.entries(QUESTION_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={q.isRequired}
                      onChange={(e) => updateQuestion(idx, { isRequired: e.target.checked })}
                      className="h-4 w-4 accent-[#2878D0]"
                    />
                    <span>پاسخ الزامی است</span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={q.isActive}
                      onChange={(e) => updateQuestion(idx, { isActive: e.target.checked })}
                      className="h-4 w-4 accent-[#20A36B]"
                    />
                    <span>در فرم عمومی نمایش داده شود (فعال)</span>
                  </label>
                </div>

                {/* Type-specific Config */}
                {(q.questionType === 'SINGLE_CHOICE' || q.questionType === 'MULTIPLE_CHOICE') && (
                  <div className="rounded-xl bg-[#F2F7FC] border border-[#E2E8F0] p-4 space-y-2.5">
                    <p className="text-xs font-semibold text-[#142B4A]">گزینه‌های سوال</p>
                    {q.options.map((opt, oIdx) => (
                      <div key={opt.tempId} className="flex items-center gap-2">
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={opt.optionText}
                          onChange={(e) => {
                            const nextOpts = q.options.map((item, k) =>
                              k === oIdx ? { ...item, optionText: e.target.value } : item
                            );
                            updateQuestion(idx, { options: nextOpts });
                          }}
                          className="flex-1 min-h-[40px] rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm"
                        />
                        {canEdit && q.options.length > 2 && (
                          <button
                            type="button"
                            aria-label="حذف گزینه"
                            onClick={() => {
                              updateQuestion(idx, {
                                options: q.options.filter((_, k) => k !== oIdx),
                              });
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#DC4444] hover:bg-white cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          updateQuestion(idx, {
                            options: [
                              ...q.options,
                              {
                                tempId: makeTempId(),
                                optionText: `گزینه ${q.options.length + 1}`,
                              },
                            ],
                          })
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2878D0] hover:underline cursor-pointer pt-1"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>افزودن گزینه</span>
                      </button>
                    )}
                  </div>
                )}

                {q.questionType === 'RATING' && (
                  <div className="rounded-xl bg-[#F2F7FC] border border-[#E2E8F0] p-4 grid grid-cols-2 gap-4 max-w-sm">
                    <div>
                      <label className="block text-xs text-[#64748B] mb-1">حداقل امتیاز</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        disabled={!canEdit}
                        value={q.config.minRating ?? 1}
                        onChange={(e) =>
                          updateQuestion(idx, {
                            config: { ...q.config, minRating: Number(e.target.value) || 1 },
                          })
                        }
                        className="w-full min-h-[40px] rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#64748B] mb-1">حداکثر امتیاز</label>
                      <input
                        type="number"
                        min={2}
                        max={10}
                        disabled={!canEdit}
                        value={q.config.maxRating ?? 5}
                        onChange={(e) =>
                          updateQuestion(idx, {
                            config: { ...q.config, maxRating: Number(e.target.value) || 5 },
                          })
                        }
                        className="w-full min-h-[40px] rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm tabular-nums"
                      />
                    </div>
                  </div>
                )}

                {q.questionType === 'YES_NO' && (
                  <div className="rounded-xl bg-[#F2F7FC] border border-[#E2E8F0] p-4 grid grid-cols-2 gap-4 max-w-md">
                    <div>
                      <label className="block text-xs text-[#64748B] mb-1">برچسب گزینه مثبت</label>
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={q.config.yesLabel ?? 'بله'}
                        onChange={(e) =>
                          updateQuestion(idx, {
                            config: { ...q.config, yesLabel: e.target.value },
                          })
                        }
                        className="w-full min-h-[40px] rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#64748B] mb-1">برچسب گزینه منفی</label>
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={q.config.noLabel ?? 'خیر'}
                        onChange={(e) =>
                          updateQuestion(idx, {
                            config: { ...q.config, noLabel: e.target.value },
                          })
                        }
                        className="w-full min-h-[40px] rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Version History */
        <div className="space-y-4">
          {allVersions.map((ver) => (
            <div key={ver.id} className="rounded-2xl bg-white border border-[#E2E8F0] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-bold text-[#142B4A] tabular-nums">
                    نسخه {toPersianDigits(ver.versionNumber)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-semibold ${
                      ver.status === 'PUBLISHED' ? 'text-[#20A36B]' : 'text-[#64748B]'
                    }`}
                  >
                    {ver.status === 'PUBLISHED' ? 'منتشرشده (فعال)' : 'بایگانی‌شده'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#64748B] tabular-nums">
                  <span>{toPersianDigits(ver._count.submissions)} ارزیابی ثبت‌شده</span>
                  {ver.publishedAt && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>انتشار: {formatJalaliDateTime(ver.publishedAt)}</span>
                    </>
                  )}
                </div>
              </div>

              <ol className="mt-4 space-y-2 text-sm text-[#1E293B]">
                {ver.questions.map((q, qIdx) => (
                  <li key={q.id} className="flex items-start justify-between gap-3 py-1">
                    <span className="tabular-nums">
                      {toPersianDigits(qIdx + 1)}. {q.questionText}
                    </span>
                    <span className="text-xs text-[#64748B] shrink-0">
                      {QUESTION_TYPE_LABELS[q.questionType]}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {/* Live Form Preview Modal */}
      {showPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="پیش‌نمایش فرم ارزیابی"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#F2F7FC] border border-[#E2E8F0] p-5 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-4">
              <h2 className="text-base font-bold text-[#142B4A]">
                پیش‌نمایش فرم (سوالات فعال پیش‌نویس)
              </h2>
              <button
                type="button"
                aria-label="بستن پیش‌نمایش"
                onClick={() => setShowPreview(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#64748B] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4">
              {previewQuestions.length === 0 ? (
                <p className="text-sm text-[#64748B] text-center py-6">
                  هیچ سوال فعالی برای نمایش وجود ندارد.
                </p>
              ) : (
                previewQuestions.map((q, idx) => (
                  <QuestionField
                    key={q.id}
                    index={idx}
                    question={q}
                    value={{}}
                    disabled
                    onChange={() => {}}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        open={confirmPublishOpen}
        title="تایید انتشار نسخه جدید فرم"
        message="با انتشار نسخه جدید، نسخه قبلی بایگانی می‌شود و ارزیابی‌های جدید از این نسخه استفاده می‌کنند. سوابق قبلی کاملاً حفظ خواهند شد. آیا ادامه می‌دهید؟"
        confirmLabel="انتشار نسخه جدید"
        variant="primary"
        busy={publishing}
        onConfirm={handlePublish}
        onCancel={() => setConfirmPublishOpen(false)}
      />
    </div>
  );
}
