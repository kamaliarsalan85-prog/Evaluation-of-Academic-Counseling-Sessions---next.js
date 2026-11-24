'use client';

import React from 'react';
import { Star, Check } from 'lucide-react';
import { toPersianDigits } from '@/lib/jalali';

export interface PublicQuestionItem {
  id: string;
  questionText: string;
  questionType: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'DESCRIPTIVE' | 'RATING' | 'YES_NO';
  isRequired: boolean;
  displayOrder: number;
  config?: {
    minRating?: number;
    maxRating?: number;
    yesLabel?: string;
    noLabel?: string;
  } | null;
  options: Array<{
    id: string;
    optionText: string;
    displayOrder: number;
  }>;
}

export interface QuestionAnswerState {
  selectedOptionId?: string | null;
  selectedOptionIds?: string[];
  textAnswer?: string;
  ratingValue?: number | null;
  yesNoValue?: boolean | null;
}

interface QuestionFieldProps {
  index: number;
  question: PublicQuestionItem;
  value: QuestionAnswerState;
  error?: string;
  disabled?: boolean;
  onChange: (next: QuestionAnswerState) => void;
}

export function QuestionField({
  index,
  question,
  value,
  error,
  disabled = false,
  onChange,
}: QuestionFieldProps) {
  const minRating = question.config?.minRating ?? 1;
  const maxRating = question.config?.maxRating ?? 5;
  const yesLabel = question.config?.yesLabel?.trim() || 'بله';
  const noLabel = question.config?.noLabel?.trim() || 'خیر';

  return (
    <fieldset
      className={`rounded-2xl bg-white border p-5 sm:p-6 transition-colors ${
        error ? 'border-[#DC4444]' : 'border-[#E2E8F0]'
      }`}
    >
      <legend className="sr-only">{question.questionText}</legend>

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F2F7FC] text-xs font-bold text-[#142B4A] tabular-nums">
            {toPersianDigits(index + 1)}
          </span>
          <p className="text-[15px] sm:text-base font-semibold leading-7 text-[#1E293B]">
            {question.questionText}
            {question.isRequired ? (
              <>
                {' '}
                <span className="text-[#DC4444]" aria-label="الزامی">
                  *
                </span>
              </>
            ) : (
              <>
                {' '}
                <span className="text-xs font-normal text-[#64748B]">(اختیاری)</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4">
        {question.questionType === 'SINGLE_CHOICE' && (
          <div className="space-y-2.5" role="radiogroup" aria-label={question.questionText}>
            {question.options.map((opt) => {
              const checked = value.selectedOptionId === opt.id;
              const inputId = `q_${question.id}_opt_${opt.id}`;
              return (
                <label
                  key={opt.id}
                  htmlFor={inputId}
                  className={`flex min-h-[46px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                    checked
                      ? 'border-[#2878D0] bg-[#F2F7FC] text-[#142B4A] font-medium'
                      : 'border-[#E2E8F0] bg-white text-[#1E293B] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <input
                    id={inputId}
                    type="radio"
                    name={`question_${question.id}`}
                    value={opt.id}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onChange({ ...value, selectedOptionId: opt.id })}
                    className="h-4 w-4 accent-[#2878D0] shrink-0"
                  />
                  <span className="leading-6">{opt.optionText}</span>
                </label>
              );
            })}
          </div>
        )}

        {question.questionType === 'MULTIPLE_CHOICE' && (
          <div className="space-y-2.5">
            {question.options.map((opt) => {
              const currentIds = value.selectedOptionIds ?? [];
              const checked = currentIds.includes(opt.id);
              const inputId = `q_${question.id}_chk_${opt.id}`;
              return (
                <label
                  key={opt.id}
                  htmlFor={inputId}
                  className={`flex min-h-[46px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                    checked
                      ? 'border-[#2878D0] bg-[#F2F7FC] text-[#142B4A] font-medium'
                      : 'border-[#E2E8F0] bg-white text-[#1E293B] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...currentIds, opt.id]
                        : currentIds.filter((id) => id !== opt.id);
                      onChange({ ...value, selectedOptionIds: next });
                    }}
                    className="h-4 w-4 rounded accent-[#2878D0] shrink-0"
                  />
                  <span className="leading-6">{opt.optionText}</span>
                </label>
              );
            })}
          </div>
        )}

        {question.questionType === 'DESCRIPTIVE' && (
          <div>
            <label htmlFor={`q_${question.id}_text`} className="sr-only">
              {question.questionText}
            </label>
            <textarea
              id={`q_${question.id}_text`}
              rows={4}
              disabled={disabled}
              value={value.textAnswer ?? ''}
              onChange={(e) => onChange({ ...value, textAnswer: e.target.value })}
              placeholder="دیدگاه یا توضیحات خود را اینجا بنویسید..."
              className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm leading-7 text-[#1E293B] placeholder:text-[#64748B]/70 focus:border-[#2878D0] focus:outline-none focus:ring-2 focus:ring-[#2878D0]/20"
            />
          </div>
        )}

        {question.questionType === 'RATING' && (
          <div>
            <div
              className="flex flex-wrap items-center gap-2 sm:gap-3"
              role="radiogroup"
              aria-label={question.questionText}
            >
              {Array.from(
                { length: maxRating - minRating + 1 },
                (_, idx) => minRating + idx
              ).map((score) => {
                const selected = value.ratingValue === score;
                const filled =
                  typeof value.ratingValue === 'number' && score <= value.ratingValue;
                return (
                  <button
                    key={score}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    aria-label={`امتیاز ${score} از ${maxRating}`}
                    onClick={() => onChange({ ...value, ratingValue: score })}
                    className={`flex min-h-[48px] min-w-[54px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors cursor-pointer tabular-nums ${
                      selected
                        ? 'border-[#2878D0] bg-[#2878D0] text-white'
                        : filled
                          ? 'border-[#2878D0]/40 bg-[#F2F7FC] text-[#142B4A]'
                          : 'border-[#E2E8F0] bg-white text-[#1E293B] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <Star
                      className={`h-4 w-4 ${
                        selected
                          ? 'fill-white text-white'
                          : filled
                            ? 'fill-[#2878D0] text-[#2878D0]'
                            : 'text-[#64748B]'
                      }`}
                      aria-hidden="true"
                    />
                    <span>{toPersianDigits(score)}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-[#64748B]">
              <span>حداقل ({toPersianDigits(minRating)})</span>
              <span>حداکثر ({toPersianDigits(maxRating)})</span>
            </div>
          </div>
        )}

        {question.questionType === 'YES_NO' && (
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={question.questionText}>
            {[
              { val: true, label: yesLabel },
              { val: false, label: noLabel },
            ].map((item) => {
              const selected = value.yesNoValue === item.val;
              return (
                <button
                  key={String(item.val)}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => onChange({ ...value, yesNoValue: item.val })}
                  className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                    selected
                      ? 'border-[#2878D0] bg-[#F2F7FC] text-[#142B4A] font-semibold'
                      : 'border-[#E2E8F0] bg-white text-[#1E293B] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {selected && <Check className="h-4 w-4 text-[#2878D0]" aria-hidden="true" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs font-medium text-[#DC4444]">
          {error}
        </p>
      )}
    </fieldset>
  );
}
