import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { DEFAULT_APP_SETTINGS } from './constants';

let initializedPromise: Promise<void> | null = null;

/**
 * Ensures default application settings, an initial published evaluation form (v1)
 * with sample Persian questions covering all 5 question types, and sample counselors
 * exist if the database is completely empty.
 * Never creates any default administrator credentials.
 */
export async function ensureDefaultAppData(): Promise<void> {
  if (!initializedPromise) {
    initializedPromise = runBootstrap().catch((err) => {
      initializedPromise = null;
      throw err;
    });
  }
  return initializedPromise;
}

async function runBootstrap(): Promise<void> {
  await prisma.appSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: DEFAULT_APP_SETTINGS,
  });

  const existingForms = await prisma.form.count();
  if (existingForms === 0) {
    await prisma.$transaction(async (tx) => {
      const formCount = await tx.form.count();
      if (formCount > 0) return;

      const form = await tx.form.create({
        data: {
          title: 'فرم ارزیابی جلسه مشاوره حضوری',
          description: 'فرم استاندارد ارزیابی کیفیت جلسات مشاوره و هدایت تحصیلی',
          status: 'ACTIVE',
        },
      });

      const publishedVersion = await tx.formVersion.create({
        data: {
          formId: form.id,
          versionNumber: 1,
          status: 'PUBLISHED',
          notes: 'نسخه اولیه فرم ارزیابی',
          publishedAt: new Date(),
        },
      });

      const sampleQuestions: Array<{
        questionText: string;
        questionType: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'DESCRIPTIVE' | 'RATING' | 'YES_NO';
        isRequired: boolean;
        displayOrder: number;
        config?: Prisma.InputJsonValue;
        options?: string[];
      }> = [
        {
          questionText: 'میزان رضایت کلی شما از جلسه مشاوره امروز چقدر بود؟',
          questionType: 'RATING',
          isRequired: true,
          displayOrder: 0,
          config: { minRating: 1, maxRating: 5 },
        },
        {
          questionText: 'شفافیت و کاربردی بودن برنامه و راهکارهای ارائه‌شده چگونه بود؟',
          questionType: 'SINGLE_CHOICE',
          isRequired: true,
          displayOrder: 1,
          options: ['بسیار عالی و کاربردی', 'خوب و قابل اجرا', 'متوسط', 'نیازمند اصلاح'],
        },
        {
          questionText: 'کدام محورها در جلسه امروز به‌خوبی بررسی شد؟',
          questionType: 'MULTIPLE_CHOICE',
          isRequired: false,
          displayOrder: 2,
          options: [
            'برنامه‌ریزی درسی و مدیریت زمان',
            'تحلیل آزمون‌ها و نقاط ضعف',
            'انتخاب رشته و هدف‌گذاری',
            'انگیزه و مدیریت استرس',
          ],
        },
        {
          questionText: 'آیا جلسه مشاوره در زمان مقرر و با تمرکز کامل برگزار شد؟',
          questionType: 'YES_NO',
          isRequired: true,
          displayOrder: 3,
          config: { yesLabel: 'بله', noLabel: 'خیر' },
        },
        {
          questionText: 'پیشنهاد یا نظر تکمیلی خود را درباره جلسه بنویسید:',
          questionType: 'DESCRIPTIVE',
          isRequired: false,
          displayOrder: 4,
        },
      ];

      for (const q of sampleQuestions) {
        const createdQ = await tx.question.create({
          data: {
            formVersionId: publishedVersion.id,
            questionText: q.questionText,
            questionType: q.questionType,
            isRequired: q.isRequired,
            isActive: true,
            displayOrder: q.displayOrder,
            config: q.config ?? Prisma.JsonNull,
          },
        });
        if (q.options && q.options.length > 0) {
          await tx.questionOption.createMany({
            data: q.options.map((opt, idx) => ({
              questionId: createdQ.id,
              optionText: opt,
              displayOrder: idx,
            })),
          });
        }
      }
    });
  }

  const existingCounselors = await prisma.counselor.count();
  if (existingCounselors === 0) {
    await prisma.counselor.createMany({
      data: [
        {
          firstName: 'سارا',
          lastName: 'محمدی',
          description: 'مشاور ارشد برنامه‌ریزی و کنکور',
          status: 'ACTIVE',
        },
        {
          firstName: 'امیرحسین',
          lastName: 'رضایی',
          description: 'مشاور تخصصی هدایت تحصیلی و انتخاب رشته',
          status: 'ACTIVE',
        },
        {
          firstName: 'مریم',
          lastName: 'کریمی',
          description: 'مشاور روانشناسی یادگیری و مدیریت زمان',
          status: 'ACTIVE',
        },
      ],
    });
  }
}
