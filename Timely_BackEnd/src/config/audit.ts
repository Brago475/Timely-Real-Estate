import prisma from "./database.js";

export async function appendAuditLog(
  actionType: string,
  entityType: string,
  entityId: string,
  performedBy: string,
  details: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
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