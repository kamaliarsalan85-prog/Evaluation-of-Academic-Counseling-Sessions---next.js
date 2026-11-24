import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureDefaultAppData } from '@/lib/bootstrap';
import { DEFAULT_APP_SETTINGS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureDefaultAppData();

    const [settings, counselors, activeVersion] = await Promise.all([
      prisma.appSettings.findUnique({ where: { id: 'default' } }),
      prisma.counselor.findMany({
        where: { status: 'ACTIVE' },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
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
                select: {
                  id: true,
                  optionText: true,
                  displayOrder: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const safeSettings = settings
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
      : {
          institutionName: DEFAULT_APP_SETTINGS.institutionName,
          appTitle: DEFAULT_APP_SETTINGS.appTitle,
          appDescription: DEFAULT_APP_SETTINGS.appDescription,
          successMessage: DEFAULT_APP_SETTINGS.successMessage,
          privacyNotice: DEFAULT_APP_SETTINGS.privacyNotice,
          isFormAvailable: DEFAULT_APP_SETTINGS.isFormAvailable,
          isPublicSubmissionEnabled: DEFAULT_APP_SETTINGS.isPublicSubmissionEnabled,
          timezone: DEFAULT_APP_SETTINGS.timezone,
        };

    return NextResponse.json({
      settings: safeSettings,
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
              config: q.config,
              options: q.options,
            })),
          }
        : null,
    });
  } catch (error) {
    console.error('Failed to load public form:', error);
    return NextResponse.json(
      { error: 'در بارگذاری فرم ارزیابی خطایی رخ داد. لطفاً لحظاتی دیگر تلاش کنید.' },
      { status: 500 }
    );
  }
}
