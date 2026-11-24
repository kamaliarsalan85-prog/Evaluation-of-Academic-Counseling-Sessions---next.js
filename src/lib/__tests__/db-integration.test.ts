import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient, Prisma } from '@prisma/client';
import { generateSecureToken, hashPassword, hashToken, verifyPassword } from '../password';
import { validatePublicSubmission, type QuestionRule } from '../validation';

function runPrismaMigrate(dbUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const prismaBin = path.resolve(process.cwd(), 'node_modules/.bin/prisma');
    const child = spawn(prismaBin, ['migrate', 'deploy'], {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: dbUrl, DIRECT_URL: dbUrl },
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`prisma migrate deploy exited ${code}: ${stderr}`));
    });
  });
}

test('PostgreSQL + Prisma end-to-end integration: migrations, versioning snapshots, counselor soft-deactivation, and RBAC', async () => {
  const pgDb = new PGlite();
  await pgDb.waitReady;

  const port = 54331;
  const socketServer = new PGLiteSocketServer({
    db: pgDb,
    port,
    host: '127.0.0.1',
    maxConnections: 10,
  });
  await socketServer.start();

  const dbUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable&connection_limit=5`;
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  try {
    // 1. Run real Prisma SQL migrations asynchronously so PGlite socket loop stays free
    await runPrismaMigrate(dbUrl);

    // 2. Create Super Admin + Regular Admin with limited permissions
    const superHash = await hashPassword('SuperSecret#123');
    const superAdmin = await prisma.administrator.create({
      data: {
        username: 'super_test',
        fullName: 'مدیر ارشد آزمون',
        passwordHash: superHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });
    assert.equal(await verifyPassword('SuperSecret#123', superAdmin.passwordHash), true);

    const regularAdmin = await prisma.administrator.create({
      data: {
        username: 'staff_test',
        fullName: 'کارشناس بررسی',
        passwordHash: await hashPassword('StaffSecret#123'),
        role: 'ADMIN',
        status: 'ACTIVE',
        permissions: {
          create: [{ permissionKey: 'VIEW_SUBMISSIONS' }],
        },
      },
      include: { permissions: true },
    });
    assert.equal(regularAdmin.permissions.length, 1);

    // 3. Create Counselor and Form v1
    const counselor = await prisma.counselor.create({
      data: { firstName: 'مریم', lastName: 'اکبری', status: 'ACTIVE' },
    });

    const form = await prisma.form.create({
      data: { title: 'فرم آزمایشی', status: 'ACTIVE' },
    });

    const v1 = await prisma.formVersion.create({
      data: {
        formId: form.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    const q1 = await prisma.question.create({
      data: {
        formVersionId: v1.id,
        questionText: 'سوال نسخه اول: کیفیت راهنمایی چطور بود؟',
        questionType: 'SINGLE_CHOICE',
        isRequired: true,
        isActive: true,
        displayOrder: 0,
        options: {
          create: [
            { optionText: 'بسیار خوب', displayOrder: 0 },
            { optionText: 'ضعیف', displayOrder: 1 },
          ],
        },
      },
      include: { options: true },
    });

    // 4. Validate and persist multiple submissions under v1
    const rules: QuestionRule[] = [
      {
        id: q1.id,
        questionText: q1.questionText,
        questionType: q1.questionType,
        isRequired: q1.isRequired,
        isActive: q1.isActive,
        displayOrder: q1.displayOrder,
        config: null,
        options: q1.options.map((o) => ({
          id: o.id,
          optionText: o.optionText,
          displayOrder: o.displayOrder,
        })),
      },
    ];

    const vRes1 = validatePublicSubmission(
      {
        firstName: 'رضا',
        lastName: 'نوری',
        counselorId: counselor.id,
        formVersionId: v1.id,
        answers: [{ questionId: q1.id, selectedOptionId: q1.options[0].id }],
      },
      rules,
      new Set([counselor.id]),
      v1.id
    );
    assert.equal(vRes1.valid, true);

    const sub1 = await prisma.submission.create({
      data: {
        firstName: vRes1.normalized!.firstName,
        lastName: vRes1.normalized!.lastName,
        counselorId: vRes1.normalized!.counselorId,
        formVersionId: vRes1.normalized!.formVersionId,
        answers: {
          create: vRes1.normalized!.answers.map((a) => ({
            questionId: a.questionId,
            answerText: a.answerText,
            answerData: a.answerData as Prisma.InputJsonValue,
            questionSnapshot: a.questionSnapshot as Prisma.InputJsonValue,
            optionsSnapshot: a.optionsSnapshot as Prisma.InputJsonValue,
          })),
        },
      },
    });

    // Second submission by same person allowed (unlimited submissions)
    const sub2 = await prisma.submission.create({
      data: {
        firstName: 'رضا',
        lastName: 'نوری',
        counselorId: counselor.id,
        formVersionId: v1.id,
      },
    });
    assert.notEqual(sub1.id, sub2.id);

    // 5. Publish Form Version 2 with modified question text -> v1 archived, v2 published
    await prisma.$transaction(async (tx) => {
      await tx.formVersion.update({
        where: { id: v1.id },
        data: { status: 'ARCHIVED' },
      });
      await tx.formVersion.create({
        data: {
          formId: form.id,
          versionNumber: 2,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          questions: {
            create: {
              questionText: 'سوال نسخه دوم: ارزیابی جدید',
              questionType: 'RATING',
              isRequired: true,
              isActive: true,
              displayOrder: 0,
              config: { minRating: 1, maxRating: 5 },
            },
          },
        },
      });
    });

    // Verify historical submission 1 STILL preserves original v1 question text & options
    const loadedSub1 = await prisma.submission.findUniqueOrThrow({
      where: { id: sub1.id },
      include: { answers: true, formVersion: true, counselor: true },
    });
    assert.equal(loadedSub1.formVersion.versionNumber, 1);
    const snap = loadedSub1.answers[0].questionSnapshot as { questionText: string };
    assert.equal(snap.questionText, 'سوال نسخه اول: کیفیت راهنمایی چطور بود؟');
    assert.equal(loadedSub1.answers[0].answerText, 'بسیار خوب');

    // 6. Verify counselor physical deletion is prevented by FK Restrict while deactivation succeeds
    await assert.rejects(() =>
      prisma.counselor.delete({ where: { id: counselor.id } })
    );
    const deactivated = await prisma.counselor.update({
      where: { id: counselor.id },
      data: { status: 'INACTIVE' },
    });
    assert.equal(deactivated.status, 'INACTIVE');

    // Historical submission still references counselor
    const stillHasCounselor = await prisma.submission.findUniqueOrThrow({
      where: { id: sub1.id },
      include: { counselor: true },
    });
    assert.equal(stillHasCounselor.counselor.lastName, 'اکبری');

    // 7. Verify AdminSession creation, tokenHash lookup, and revocation
    const rawSessionToken = generateSecureToken(32);
    const csrfToken = generateSecureToken(24);
    const sessionRow = await prisma.adminSession.create({
      data: {
        adminId: superAdmin.id,
        tokenHash: hashToken(rawSessionToken),
        csrfToken,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    const fetchedSession = await prisma.adminSession.findUnique({
      where: { tokenHash: hashToken(rawSessionToken) },
      include: { admin: true },
    });
    assert.ok(fetchedSession);
    assert.equal(fetchedSession.admin.username, 'super_test');
    assert.equal(fetchedSession.revokedAt, null);

    await prisma.adminSession.update({
      where: { id: sessionRow.id },
      data: { revokedAt: new Date() },
    });
    const revokedSession = await prisma.adminSession.findUnique({
      where: { id: sessionRow.id },
    });
    assert.ok(revokedSession?.revokedAt !== null);
  } finally {
    await prisma.$disconnect();
    await socketServer.stop();
    await pgDb.close();
  }
});
