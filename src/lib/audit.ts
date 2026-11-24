import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export interface AuditLogInput {
  adminId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function recordAuditLog(
  input: AuditLogInput,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      adminId: input.adminId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
