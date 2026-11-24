import { z } from 'zod';
import { ALL_PERMISSIONS } from './constants';

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export const counselorSchema = z.object({
  firstName: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(2, 'نام مشاور باید حداقل ۲ کاراکتر باشد').max(60, 'نام مشاور طولانی است')),
  lastName: z
    .string()
    .transform(normalizeText)
    .pipe(
      z
        .string()
        .min(2, 'نام خانوادگی مشاور باید حداقل ۲ کاراکتر باشد')
        .max(60, 'نام خانوادگی مشاور طولانی است')
    ),
  description: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? normalizeText(v) : null)),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const questionConfigSchema = z
  .object({
    minRating: z.number().int().min(1).max(10).optional(),
    maxRating: z.number().int().min(2).max(10).optional(),
    yesLabel: z.string().max(40).optional(),
    noLabel: z.string().max(40).optional(),
  })
  .optional()
  .nullable();

export const draftQuestionSchema = z.object({
  id: z.string().optional(),
  questionText: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(3, 'متن سوال باید حداقل ۳ کاراکتر باشد').max(500, 'متن سوال طولانی است')),
  questionType: z.enum([
    'SINGLE_CHOICE',
    'MULTIPLE_CHOICE',
    'DESCRIPTIVE',
    'RATING',
    'YES_NO',
  ]),
  isRequired: z.boolean(),
  isActive: z.boolean(),
  displayOrder: z.number().int().min(0),
  config: questionConfigSchema,
  options: z
    .array(
      z.object({
        id: z.string().optional(),
        optionText: z
          .string()
          .transform(normalizeText)
          .pipe(z.string().min(1, 'متن گزینه نمی‌تواند خالی باشد').max(200)),
        displayOrder: z.number().int().min(0),
      })
    )
    .default([]),
});

export const saveDraftFormSchema = z.object({
  notes: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? normalizeText(v) : null)),
  questions: z.array(draftQuestionSchema).min(1, 'فرم باید حداقل شامل یک سوال باشد'),
});

export const adminCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'نام کاربری باید حداقل ۳ کاراکتر باشد')
    .max(40, 'نام کاربری حداکثر ۴۰ کاراکتر است')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'نام کاربری فقط می‌تواند شامل حروف انگلیسی، اعداد و _ . - باشد'),
  fullName: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(2, 'نام و نام خانوادگی الزامی است').max(80)),
  password: z
    .string()
    .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد')
    .max(128, 'رمز عبور بیش از حد طولانی است'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN']),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).default([]),
});

export const adminUpdateSchema = z.object({
  fullName: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(2, 'نام و نام خانوادگی الزامی است').max(80))
    .optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).optional(),
  password: z
    .string()
    .min(8, 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد')
    .max(128)
    .optional(),
});

export const appSettingsUpdateSchema = z.object({
  institutionName: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(2).max(100)),
  appTitle: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(2).max(120)),
  appDescription: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(5).max(500)),
  successMessage: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(3).max(300)),
  privacyNotice: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(10).max(1000)),
  isFormAvailable: z.boolean(),
  isPublicSubmissionEnabled: z.boolean(),
  timezone: z.string().min(3).max(60),
});

export const submissionEditSchema = z.object({
  firstName: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(2, 'نام باید حداقل ۲ کاراکتر باشد').max(60)),
  lastName: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(2, 'نام خانوادگی باید حداقل ۲ کاراکتر باشد').max(60)),
  counselorId: z.string().uuid('شناسه مشاور معتبر نیست'),
});

export interface QuestionRule {
  id: string;
  questionText: string;
  questionType: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'DESCRIPTIVE' | 'RATING' | 'YES_NO';
  isRequired: boolean;
  isActive: boolean;
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

export interface RawAnswerInput {
  questionId: string;
  selectedOptionId?: string | null;
  selectedOptionIds?: string[] | null;
  textAnswer?: string | null;
  ratingValue?: number | null;
  yesNoValue?: boolean | null;
}

export interface ValidatedSubmissionResult {
  valid: boolean;
  fieldErrors: Record<string, string>;
  normalized?: {
    firstName: string;
    lastName: string;
    counselorId: string;
    formVersionId: string;
    answers: Array<{
      questionId: string;
      answerText: string | null;
      answerData: Record<string, unknown>;
      questionSnapshot: Record<string, unknown>;
      optionsSnapshot: Array<Record<string, unknown>> | null;
    }>;
  };
}

export function validatePublicSubmission(
  payload: {
    firstName?: unknown;
    lastName?: unknown;
    counselorId?: unknown;
    formVersionId?: unknown;
    website?: unknown; // honeypot
    answers?: unknown;
  },
  activeQuestions: QuestionRule[],
  validCounselorIds: Set<string>,
  activeFormVersionId: string
): ValidatedSubmissionResult {
  const fieldErrors: Record<string, string> = {};

  if (typeof payload.website === 'string' && payload.website.trim().length > 0) {
    fieldErrors._form = 'درخواست نامعتبر است.';
    return { valid: false, fieldErrors };
  }

  const firstName =
    typeof payload.firstName === 'string' ? normalizeText(payload.firstName) : '';
  const lastName =
    typeof payload.lastName === 'string' ? normalizeText(payload.lastName) : '';
  const counselorId =
    typeof payload.counselorId === 'string' ? payload.counselorId.trim() : '';
  const formVersionId =
    typeof payload.formVersionId === 'string' ? payload.formVersionId.trim() : '';

  if (firstName.length < 2 || firstName.length > 60) {
    fieldErrors.firstName = 'لطفاً نام خود را به‌صورت صحیح (حداقل ۲ حرف) وارد کنید.';
  }
  if (lastName.length < 2 || lastName.length > 60) {
    fieldErrors.lastName = 'لطفاً نام خانوادگی خود را به‌صورت صحیح (حداقل ۲ حرف) وارد کنید.';
  }
  if (!counselorId || !validCounselorIds.has(counselorId)) {
    fieldErrors.counselorId = 'لطفاً یک مشاور فعال را از فهرست انتخاب کنید.';
  }
  if (!formVersionId || formVersionId !== activeFormVersionId) {
    fieldErrors._form = 'نسخه فرم ارزیابی به‌روزرسانی شده است. لطفاً صفحه را تازه کنید.';
  }

  const rawAnswers = Array.isArray(payload.answers)
    ? (payload.answers as RawAnswerInput[])
    : [];
  const answerMap = new Map<string, RawAnswerInput>();
  for (const item of rawAnswers) {
    if (item && typeof item.questionId === 'string') {
      answerMap.set(item.questionId, item);
    }
  }

  const preparedAnswers: NonNullable<ValidatedSubmissionResult['normalized']>['answers'] = [];

  for (const question of activeQuestions) {
    if (!question.isActive) continue;
    const input = answerMap.get(question.id);
    const errKey = `question_${question.id}`;

    const questionSnapshot = {
      id: question.id,
      questionText: question.questionText,
      questionType: question.questionType,
      isRequired: question.isRequired,
      displayOrder: question.displayOrder,
      config: question.config ?? null,
    };

    const optionsSnapshot =
      question.options.length > 0
        ? question.options.map((opt) => ({
            id: opt.id,
            optionText: opt.optionText,
            displayOrder: opt.displayOrder,
          }))
        : null;

    if (question.questionType === 'SINGLE_CHOICE') {
      const selectedId =
        input && typeof input.selectedOptionId === 'string'
          ? input.selectedOptionId.trim()
          : '';
      if (!selectedId) {
        if (question.isRequired) {
          fieldErrors[errKey] = 'انتخاب یکی از گزینه‌ها برای این سوال الزامی است.';
        }
        continue;
      }
      const matched = question.options.find((o) => o.id === selectedId);
      if (!matched) {
        fieldErrors[errKey] = 'گزینه انتخاب‌شده معتبر نیست.';
        continue;
      }
      preparedAnswers.push({
        questionId: question.id,
        answerText: matched.optionText,
        answerData: {
          type: 'SINGLE_CHOICE',
          selectedOptionId: matched.id,
          selectedOptionText: matched.optionText,
        },
        questionSnapshot,
        optionsSnapshot,
      });
    } else if (question.questionType === 'MULTIPLE_CHOICE') {
      const ids = Array.isArray(input?.selectedOptionIds)
        ? Array.from(
            new Set(
              input.selectedOptionIds
                .filter((x): x is string => typeof x === 'string')
                .map((x) => x.trim())
                .filter(Boolean)
            )
          )
        : [];
      if (ids.length === 0) {
        if (question.isRequired) {
          fieldErrors[errKey] = 'انتخاب حداقل یک گزینه برای این سوال الزامی است.';
        }
        continue;
      }
      const matchedOptions = ids
        .map((id) => question.options.find((o) => o.id === id))
        .filter((o): o is NonNullable<typeof o> => Boolean(o));

      if (matchedOptions.length !== ids.length) {
        fieldErrors[errKey] = 'یک یا چند گزینه انتخاب‌شده معتبر نیستند.';
        continue;
      }
      preparedAnswers.push({
        questionId: question.id,
        answerText: matchedOptions.map((o) => o.optionText).join('، '),
        answerData: {
          type: 'MULTIPLE_CHOICE',
          selectedOptionIds: matchedOptions.map((o) => o.id),
          selectedOptionTexts: matchedOptions.map((o) => o.optionText),
        },
        questionSnapshot,
        optionsSnapshot,
      });
    } else if (question.questionType === 'DESCRIPTIVE') {
      const text =
        input && typeof input.textAnswer === 'string' ? normalizeText(input.textAnswer) : '';
      if (!text) {
        if (question.isRequired) {
          fieldErrors[errKey] = 'پاسخ متنی به این سوال الزامی است.';
        }
        continue;
      }
      if (text.length > 2000) {
        fieldErrors[errKey] = 'حداکثر طول پاسخ تشریحی ۲۰۰۰ کاراکتر است.';
        continue;
      }
      preparedAnswers.push({
        questionId: question.id,
        answerText: text,
        answerData: {
          type: 'DESCRIPTIVE',
          text,
        },
        questionSnapshot,
        optionsSnapshot,
      });
    } else if (question.questionType === 'RATING') {
      const min = question.config?.minRating ?? 1;
      const max = question.config?.maxRating ?? 5;
      const val = input?.ratingValue;
      if (val === null || val === undefined) {
        if (question.isRequired) {
          fieldErrors[errKey] = 'لطفاً امتیاز مورد نظر خود را انتخاب کنید.';
        }
        continue;
      }
      if (typeof val !== 'number' || !Number.isInteger(val) || val < min || val > max) {
        fieldErrors[errKey] = `امتیاز باید عددی بین ${min} تا ${max} باشد.`;
        continue;
      }
      preparedAnswers.push({
        questionId: question.id,
        answerText: `${val} از ${max}`,
        answerData: {
          type: 'RATING',
          rating: val,
          min,
          max,
        },
        questionSnapshot,
        optionsSnapshot,
      });
    } else if (question.questionType === 'YES_NO') {
      const val = input?.yesNoValue;
      if (val === null || val === undefined) {
        if (question.isRequired) {
          fieldErrors[errKey] = 'لطفاً یکی از گزینه‌های بله یا خیر را انتخاب کنید.';
        }
        continue;
      }
      if (typeof val !== 'boolean') {
        fieldErrors[errKey] = 'پاسخ انتخاب‌شده معتبر نیست.';
        continue;
      }
      const yesLabel = question.config?.yesLabel?.trim() || 'بله';
      const noLabel = question.config?.noLabel?.trim() || 'خیر';
      const chosenLabel = val ? yesLabel : noLabel;
      preparedAnswers.push({
        questionId: question.id,
        answerText: chosenLabel,
        answerData: {
          type: 'YES_NO',
          value: val,
          label: chosenLabel,
        },
        questionSnapshot,
        optionsSnapshot,
      });
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, fieldErrors };
  }

  return {
    valid: true,
    fieldErrors: {},
    normalized: {
      firstName,
      lastName,
      counselorId,
      formVersionId,
      answers: preparedAnswers,
    },
  };
}
