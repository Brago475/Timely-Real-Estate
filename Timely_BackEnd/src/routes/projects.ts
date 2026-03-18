import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// POST /api/projects — Create a new project in the current org
router.post("/projects", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const { projectName, clientName, status, priority, budget, dateCreated, dateDue, description } = req.body || {};
  const orgId = req.user!.orgId;

  if (!projectName) return res.status(400).json({ error: "projectName is required." });

  try {
    const project = await prisma.project.create({
      data: {
        code: "TEMP",
        organizationId: orgId,
        name: projectName,
        description: description || "",
        status: status || "planning",
        priority: priority || "medium",
        budget: budget ? parseFloat(budget) : null,
        dateCreated: dateCreated ? new Date(dateCreated) : null,
        dateDue: dateDue ? new Date(dateDue) : null,
        createdBy: req.user?.userId || null,
      },
    });

    const code = formatCode("P", project.id);
    await prisma.project.update({ where: { id: project.id }, data: { code } });

    await appendAuditLog(orgId, "CREATE_PROJECT", "project", code, req.user?.email || "unknown", `Project created: ${projectName}`);
    return res.json({ success: true, projectId: project.id, projectCode: code });
  } catch (err) {
    console.error("Error creating project:", err);
    return res.status(500).json({ error: "Failed to create project." });
  }
});

// GET /api/projects — List all projects in the current org
router.get("/projects", authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;

  try {
    const projects = await prisma.project.findMany({
      where: { organizationId: orgId },
      orderBy: { id: "asc" },
      include: {
        clientProjects: {
          include: { client: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    const data = projects.map((p) => {
      const clientNames = p.clientProjects.map((cp) => `${cp.client.firstName} ${cp.client.lastName}`.trim()).join(", ");
      return {
        projectId: String(p.id), projectCode: p.code, projectName: p.name, clientName: clientNames,
        status: p.status, priority: p.priority,
        budget: p.budget ? String(p.budget) : "", description: p.description,
        startDate: p.dateCreated ? p.dateCreated.toISOString().split("T")[0] : "",
        endDate: p.dateDue ? p.dateDue.toISOString().split("T")[0] : "",
        dateCreated: p.dateCreated ? p.dateCreated.toISOString().split("T")[0] : "",
        dateDue: p.dateDue ? p.dateDue.toISOString().split("T")[0] : "",
        createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
      };
    });

    return res.json({ data });
  } catch (err) {
    console.error("Error reading projects:", err);
    return res.status(500).json({ error: "Failed to read projects." });
  }
});

// POST /api/projects-delete — Delete a project from the current org
router.post("/projects-delete", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const { projectId } = req.body || {};
  const orgId = req.user!.orgId;

  if (!projectId) return res.status(400).json({ error: "projectId is required." });

  try {
    const project = await prisma.project.findFirst({
      where: { id: Number(projectId), organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found in this organization." });

    await prisma.project.delete({ where: { id: project.id } });
    await appendAuditLog(orgId, "DELETE_PROJECT", "project", project.code, req.user?.email || "unknown", `Project deleted: ${project.name}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting project:", err);
    return res.status(500).json({ error: "Failed to delete project." });
  }
});

// POST /api/projects/assign — Assign client and consultants to a project
router.post("/projects/assign", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const { clientId, projectId, consultantIds } = req.body || {};
  const orgId = req.user!.orgId;

  if (!clientId || !projectId) return res.status(400).json({ error: "clientId and projectId are required." });

  try {
    // Verify project belongs to this org
    const project = await prisma.project.findFirst({
      where: { id: Number(projectId), organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found in this organization." });

    // Verify client is in this org
    const clientMember = await prisma.orgMember.findFirst({
      where: { userId: Number(clientId), organizationId: orgId, role: "client" },
    });
    if (!clientMember) return res.status(404).json({ error: "Client not found in this organization." });

    await prisma.clientProject.updateMany({ where: { clientId: Number(clientId) }, data: { isCurrent: false } });

    await prisma.clientProject.upsert({
      where: { clientId_projectId: { clientId: Number(clientId), projectId: Number(projectId) } },
      update: { isCurrent: true },
      create: { clientId: Number(clientId), projectId: Number(projectId), isCurrent: true },
    });

    if (Array.isArray(consultantIds) && consultantIds.length > 0) {
      for (const cid of consultantIds) {
        // Verify consultant is in this org
        const conMember = await prisma.orgMember.findFirst({
          where: { userId: Number(cid), organizationId: orgId, role: "consultant" },
        });
        if (!conMember) continue;

        await prisma.consultantProject.upsert({
          where: { consultantId_projectId: { consultantId: Number(cid), projectId: Number(projectId) } },
          update: {},
          create: { consultantId: Number(cid), projectId: Number(projectId) },
        });
      }
    }

    await appendAuditLog(orgId, "ASSIGN_PROJECT", "project_assignment", `C${clientId}-P${projectId}`, req.user?.email || "unknown", `Project ${projectId} assigned to client ${clientId}`);

    const client = await prisma.user.findUnique({ where: { id: Number(clientId) } });

    if (client) {
      await prisma.emailOutbox.create({
        data: {
          code: formatCode("EM", Date.now() % 10000),
          organizationId: orgId,
          toEmail: client.email,
          subject: `New Project Assigned: ${project.name}`,
          body: `Hi ${client.firstName},\n\nA new project has been assigned to you:\n\nProject: ${project.name}\nProject Code: ${project.code}\n\nLog in to your portal to view details.\n\nBest regards,\nThe Timely Team`,
        },
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Error assigning project:", err);
    return res.status(500).json({ error: "Failed to assign project." });
  }
});

// POST /api/project-details — Update project details
router.post("/project-details", authenticate, authorize("owner", "admin", "consultant"), async (req: Request, res: Response) => {
  const { projectId, dateCreated, dateDue, description, status, priority } = req.body || {};
  const orgId = req.user!.orgId;

  if (!projectId) return res.status(400).json({ error: "projectId is required." });

  try {
    const project = await prisma.project.findFirst({
      where: { id: Number(projectId), organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found in this organization." });

    await prisma.project.update({
      where: { id: project.id },
      data: {
        dateCreated: dateCreated ? new Date(dateCreated) : project.dateCreated,
        dateDue: dateDue ? new Date(dateDue) : project.dateDue,
        description: description !== undefined ? description : project.description,
        status: status !== undefined ? status : project.status,
        priority: priority !== undefined ? priority : project.priority,
      },
    });

    await appendAuditLog(orgId, "UPDATE_PROJECT_DETAILS", "project_details", project.code, req.user?.email || "unknown", `Project updated: ${project.name}${status ? ` -> ${status}` : ""}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("Error updating project details:", err);
    return res.status(500).json({ error: "Failed to update project details." });
  }
});

// GET /api/project-details/:projectId — Get project details
router.get("/project-details/:projectId", authenticate, async (req: Request, res: Response) => {
  const projectId = String(req.params.projectId);
  const orgId = req.user!.orgId;

  try {
    const project = await prisma.project.findFirst({
      where: { id: Number(projectId), organizationId: orgId },
    });
    if (!project) return res.json({ data: null });

    return res.json({
      data: {
        projectId: String(project.id),
        dateCreated: project.dateCreated ? project.dateCreated.toISOString().split("T")[0] : "",
        dateDue: project.dateDue ? project.dateDue.toISOString().split("T")[0] : "",
        description: project.description, status: project.status, priority: project.priority,
        createdAt: project.createdAt.toISOString(), updatedAt: project.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Error reading project details:", err);
    return res.status(500).json({ error: "Failed to read project details." });
  }
});

export default router;