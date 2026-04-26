import prisma from './prisma'
import { AuditAction } from '@/types'

interface AuditParams {
  userId: string
  userName: string
  action: AuditAction
  entity: string
  entityId?: string
  oldData?: object
  newData?: object
  ipAddress?: string
}

export async function createAuditLog(params: AuditParams) {
  return await prisma.auditLog.create({
    data: {
      userId: params.userId,
      userName: params.userName,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? '',
      oldData: params.oldData ?? undefined,
      newData: params.newData ?? undefined,
      ipAddress: params.ipAddress ?? '',
    },
  })
}