import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// GET /api/audit-logs/latest — Get recent audit logs for current org
router.get("/audit-logs/latest", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const limit = Number(req.query.limit ?? 10);
  const orgId = req.user!.orgId;

  try {
    const logs = await prisma.auditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    const data = logs.map((l) => ({
      logId: String(l.id),
      timestamp: l.timestamp.toISOString(),
      actionType: l.actionType,
      entityType: l.entityType,
      entityId: l.entityId,
      performedBy: l.performedBy,
      details: l.details,
    }));

    return res.json({ data });
  } catch (err) {
    console.error("Error reading audit logs:", err);
    return res.status(500).json({ error: "Failed to read audit logs." });
  }
});

export default router;