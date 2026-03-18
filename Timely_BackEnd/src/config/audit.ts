import prisma from "./database.js";

export async function appendAuditLog(
  organizationId: number,
  actionType: string,
  entityType: string,
  entityId: string,
  performedBy: string,
  details: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId,
        actionType,
        entityType,
        entityId,
        performedBy,
        details,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}