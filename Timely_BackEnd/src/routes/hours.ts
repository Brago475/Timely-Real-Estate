import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// POST /api/hours-logs — Log hours
router.post("/hours-logs", authenticate, authorize("admin", "consultant"), async (req: Request, res: Response) => {
  const { projectId, consultantId, date, hours, description } = req.body || {};

  if (!projectId || !consultantId || !date || hours === undefined) {
    return res.status(400).json({ error: "projectId, consultantId, date, and hours are required." });
  }

  try {
    const log = await prisma.hoursLog.create({
      data: {
        code: "TEMP",
        projectId: Number(projectId),
        consultantId: Number(consultantId),
        logDate: new Date(date),
        hours: parseFloat(hours),
        description: description || "",
        status: "pending",
      },
    });

    const code = formatCode("HL", log.id);
    await prisma.hoursLog.update({
      where: { id: log.id },
      data: { code },
    });

    await appendAuditLog(
      "LOG_HOURS",
      "hours_log",
      code,
      req.user?.email || "unknown",
      `Hours logged: ${hours}h for consultant ${consultantId} on project ${projectId}`
    );

    return res.json({ success: true, logId: log.id, logCode: code });
  } catch (err) {
    console.error("Error logging hours:", err);
    return res.status(500).json({ error: "Failed to log hours." });
  }
});

// GET /api/hours-logs — List all hours (optional filter by consultantId)
router.get("/hours-logs", authenticate, authorize("admin", "consultant"), async (req: Request, res: Response) => {
  const { consultantId } = req.query;

  try {
    const where: any = {};
    if (consultantId) where.consultantId = Number(consultantId);

    const logs = await prisma.hoursLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { name: true, code: true } },
        consultant: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    const data = logs.map((l) => ({
      logId: String(l.id),
      logCode: l.code,
      projectId: String(l.projectId),
      projectName: l.project.name,
      projectCode: l.project.code,
      consultantId: String(l.consultantId),
      consultantName: `${l.consultant.firstName} ${l.consultant.lastName}`.trim(),
      date: l.logDate.toISOString().split("T")[0],
      hours: Number(l.hours),
      description: l.description,
      status: l.status,
      createdAt: l.createdAt.toISOString(),
    }));

    return res.json({ data });
  } catch (err) {
    console.error("Error reading hours logs:", err);
    return res.status(500).json({ error: "Failed to read hours logs." });
  }
});

// GET /api/hours-logs/:projectId — Hours by project
router.get("/hours-logs/:projectId", authenticate, authorize("admin", "consultant"), async (req: Request, res: Response) => {
  const { projectId } = req.params;

  try {
    const logs = await prisma.hoursLog.findMany({
      where: { projectId: Number(projectId) },
      orderBy: { createdAt: "desc" },
      include: {
        consultant: { select: { firstName: true, lastName: true } },
      },
    });

    const data = logs.map((l) => ({
      logId: String(l.id),
      logCode: l.code,
      projectId: String(l.projectId),
      consultantId: String(l.consultantId),
      consultantName: `${l.consultant.firstName} ${l.consultant.lastName}`.trim(),
      date: l.logDate.toISOString().split("T")[0],
      hours: Number(l.hours),
      description: l.description,
      status: l.status,
      createdAt: l.createdAt.toISOString(),
    }));

    return res.json({ data });
  } catch (err) {
    console.error("Error reading hours logs:", err);
    return res.status(500).json({ error: "Failed to read hours logs." });
  }
});

// POST /api/hours-logs-delete — Delete hours log
router.post("/hours-logs-delete", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  const { logId } = req.body || {};

  if (!logId) {
    return res.status(400).json({ error: "logId is required." });
  }

  try {
    const log = await prisma.hoursLog.findUnique({
      where: { id: Number(logId) },
    });

    if (!log) {
      return res.status(404).json({ error: "Hours log not found." });
    }

    await prisma.hoursLog.delete({ where: { id: log.id } });

    await appendAuditLog(
      "DELETE_HOURS_LOG",
      "hours_log",
      log.code,
      req.user?.email || "unknown_admin",
      `Hours log deleted: ${log.hours}h on ${log.logDate.toISOString().split("T")[0]}`
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting hours log:", err);
    return res.status(500).json({ error: "Failed to delete hours log." });
  }
});

export default router;