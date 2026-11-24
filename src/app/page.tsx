import {
  prisma,
  inspectDatabaseUrlStatus,
  getDatabaseConfigErrorMessage,
} from '@/lib/prisma';
import { ensureDefaultAppData } from '@/lib/bootstrap';
import { DEFAULT_APP_SETTINGS } from '@/lib/constants';
import {
  PublicEvaluationClient,
  type PublicFormPayload,
} from '@/components/public/PublicEvaluationClient';
import type { PublicQuestionItem } from '@/components/public/QuestionField';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const defaultSettings = {
    institutionName: DEFAULT_APP_SETTINGS.institutionName,
    appTitle: DEFAULT_APP_SETTINGS.appTitle,
    appDescription: DEFAULT_APP_SETTINGS.appDescription,
    successMessage: DEFAULT_APP_SETTINGS.successMessage,
    privacyNotice: DEFAULT_APP_SETTINGS.privacyNotice,
    isFormAvailable: DEFAULT_APP_SETTINGS.isFormAvailable,
    isPublicSubmissionEnabled: DEFAULT_APP_SETTINGS.isPublicSubmissionEnabled,
    timezone: DEFAULT_APP_SETTINGS.timezone,
  };

  const dbStatus = inspectDatabaseUrlStatus(process.env.DATABASE_URL);
  if (!dbStatus.valid) {
    return (
      <PublicEvaluationClient
        initialData={{
          settings: defaultSettings,
          counselors: [],
          formVersion: null,
        }}
        dbError={getDatabaseConfigErrorMessage(dbStatus.issue)}
      />
    );
  }

  try {
    await ensureDefaultAppData();

    const [settings, counselors, activeVersion] = await Promise.all([
      prisma.appSettings.findUnique({ where: { id: 'default' } }),
      prisma.counselor.findMany({
        where: { status: 'ACTIVE' },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: { id: true, firstName: true, lastName: true },
      }),
      prisma.formVersion.findFirst({
        where: { status: 'PUBLISHED' },
        orderBy: { versionNumber: 'desc' },
        include: {
          questions: {
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' },
            include: {
              options: {
                orderBy: { displayOrder: 'asc' },
                select: { id: true, optionText: true, displayOrder: true },
              },
            },
          },
        },
      }),
    ]);

    const initialData: PublicFormPayload = {
      settings: settings
        ? {
            institutionName: settings.institutionName,
            appTitle: settings.appTitle,
            appDescription: settings.appDescription,
            successMessage: settings.successMessage,
            privacyNotice: settings.privacyNotice,
            isFormAvailable: settings.isFormAvailable,
            isPublicSubmissionEnabled: settings.isPublicSubmissionEnabled,
            timezone: settings.timezone,
          }
        : defaultSettings,
      counselors,
      formVersion: activeVersion
        ? {
            id: activeVersion.id,
            versionNumber: activeVersion.versionNumber,
            questions: activeVersion.questions.map((q) => ({
              id: q.id,
              questionText: q.questionText,
              questionType: q.questionType,
              isRequired: q.isRequired,
              displayOrder: q.displayOrder,
              config: (q.config as PublicQuestionItem['config']) ?? null,
              options: q.options,
            })),
          }
        : null,
    };

    return <PublicEvaluationClient initialData={initialData} />;
  } catch (error) {
    console.warn(
      'HomePage database initialization/load failed:',
      error instanceof Error ? error.message : 'Unknown DB error'
    );
    return (
      <PublicEvaluationClient
        initialData={{
          settings: defaultSettings,
          counselors: [],
          formVersion: null,
        }}
        dbError="در حال حاضر امکان اتصال به پایگاه داده وجود ندارد. لطفاً تنظیمات اتصال و اعتبارنامه‌های PostgreSQL (مانند DATABASE_URL) را در بخش Secrets بررسی کنید."
      />
    );
  }
}
