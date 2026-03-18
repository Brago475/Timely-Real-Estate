import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// POST /api/hours-logs — Log hours (project must belong to current org)
router.post("/hours-logs", authenticate, authorize("owner", "admin", "consultant"), async (req: Request, res: Response) => {
  const { projectId, consultantId, date, hours, description } = req.body || {};
  const orgId = req.user!.orgId;

  if (!projectId || !consultantId || !date || hours === undefined) {
    return res.status(400).json({ error: "projectId, consultantId, date, and hours are required." });
  }

  try {
    // Verify project belongs to this org
    const project = await prisma.project.findFirst({
      where: { id: Number(projectId), organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found in this organization." });

    // Verify consultant is in this org
    const conMember = await prisma.orgMember.findFirst({
      where: { userId: Number(consultantId), organizationId: orgId, role: "consultant" },
    });
    if (!conMember) return res.status(404).json({ error: "Consultant not found in this organization." });

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
    await prisma.hoursLog.update({ where: { id: log.id }, data: { code } });

    await appendAuditLog(
      orgId, "LOG_HOURS", "hours_log", code,
      req.user?.email || "unknown",
      `Hours logged: ${hours}h for consultant ${consultantId} on project ${projectId}`
    );

    return res.json({ success: true, logId: log.id, logCode: code });
  } catch (err) {
    console.error("Error logging hours:", err);
    return res.status(500).json({ error: "Failed to log hours." });
  }
});

// GET /api/hours-logs — List all hours in current org (optional filter by consultantId)
router.get("/hours-logs", authenticate, authorize("owner", "admin", "consultant"), async (req: Request, res: Response) => {
  const { consultantId } = req.query;
  const orgId = req.user!.orgId;

  try {
    // Get all project IDs in this org
    const orgProjects = await prisma.project.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    const projectIds = orgProjects.map((p) => p.id);

    const where: any = { projectId: { in: projectIds } };
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

// GET /api/hours-logs/:projectId — Hours by project (must belong to current org)
router.get("/hours-logs/:projectId", authenticate, authorize("owner", "admin", "consultant"), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = req.user!.orgId;

  try {
    const project = await prisma.project.findFirst({
      where: { id: Number(projectId), organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found in this organization." });

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

// POST /api/hours-logs-delete — Delete hours log (project must belong to current org)
router.post("/hours-logs-delete", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const { logId } = req.body || {};
  const orgId = req.user!.orgId;

  if (!logId) {
    return res.status(400).json({ error: "logId is required." });
  }

  try {
    const log = await prisma.hoursLog.findUnique({
      where: { id: Number(logId) },
      include: { project: { select: { organizationId: true } } },
    });

    if (!log || log.project.organizationId !== orgId) {
      return res.status(404).json({ error: "Hours log not found in this organization." });
    }

    await prisma.hoursLog.delete({ where: { id: log.id } });

    await appendAuditLog(
      orgId, "DELETE_HOURS_LOG", "hours_log", log.code,
      req.user?.email || "unknown",
      `Hours log deleted: ${log.hours}h on ${log.logDate.toISOString().split("T")[0]}`
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting hours log:", err);
    return res.status(500).json({ error: "Failed to delete hours log." });
  }
});

export default router;