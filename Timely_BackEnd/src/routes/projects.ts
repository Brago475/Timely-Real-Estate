import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.post("/projects", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  const { projectName, clientName, status, priority, budget, dateCreated, dateDue, description } = req.body || {};
  if (!projectName) return res.status(400).json({ error: "projectName is required." });

  try {
    const project = await prisma.project.create({
      data: {
        code: "TEMP", name: projectName, description: description || "",
        status: status || "planning", priority: priority || "medium",
        budget: budget ? parseFloat(budget) : null,
        dateCreated: dateCreated ? new Date(dateCreated) : null,
        dateDue: dateDue ? new Date(dateDue) : null,
        createdBy: req.user?.userId || null,
      },
    });

    const code = formatCode("P", project.id);
    await prisma.project.update({ where: { id: project.id }, data: { code } });

    await appendAuditLog("CREATE_PROJECT", "project", code, req.user?.email || "unknown_admin", `Project created: ${projectName}`);
    return res.json({ success: true, projectId: project.id, projectCode: code });
  } catch (err) {
    console.error("Error creating project:", err);
    return res.status(500).json({ error: "Failed to create project." });
  }
});

router.get("/projects", authenticate, async (req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
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

router.post("/projects-delete", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  const { projectId } = req.body || {};
  if (!projectId) return res.status(400).json({ error: "projectId is required." });

  try {
    const project = await prisma.project.findUnique({ where: { id: Number(projectId) } });
    if (!project) return res.status(404).json({ error: "Project not found." });

    await prisma.project.delete({ where: { id: project.id } });
    await appendAuditLog("DELETE_PROJECT", "project", project.code, req.user?.email || "unknown_admin", `Project deleted: ${project.name}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting project:", err);
    return res.status(500).json({ error: "Failed to delete project." });
  }
});

router.post("/projects/assign", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  const { clientId, projectId, consultantIds } = req.body || {};
  if (!clientId || !projectId) return res.status(400).json({ error: "clientId and projectId are required." });

  try {
    await prisma.clientProject.updateMany({ where: { clientId: Number(clientId) }, data: { isCurrent: false } });

    await prisma.clientProject.upsert({
      where: { clientId_projectId: { clientId: Number(clientId), projectId: Number(projectId) } },
      update: { isCurrent: true },
      create: { clientId: Number(clientId), projectId: Number(projectId), isCurrent: true },
    });

    if (Array.isArray(consultantIds) && consultantIds.length > 0) {
      for (const cid of consultantIds) {
        await prisma.consultantProject.upsert({
          where: { consultantId_projectId: { consultantId: Number(cid), projectId: Number(projectId) } },
          update: {},
          create: { consultantId: Number(cid), projectId: Number(projectId) },
        });
      }
    }

    await appendAuditLog("ASSIGN_PROJECT", "project_assignment", `C${clientId}-P${projectId}`, req.user?.email || "unknown_admin", `Project ${projectId} assigned to client ${clientId}`);

    const client = await prisma.user.findUnique({ where: { id: Number(clientId) } });
    const project = await prisma.project.findUnique({ where: { id: Number(projectId) } });

    if (client && project) {
      const emailCode = formatCode("EM", Date.now() % 10000);
      await prisma.emailOutbox.create({
        data: {
          code: emailCode, toEmail: client.email,
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

router.post("/project-details", authenticate, authorize("admin", "consultant"), async (req: Request, res: Response) => {
  const { projectId, dateCreated, dateDue, description, status, priority } = req.body || {};
  if (!projectId) return res.status(400).json({ error: "projectId is required." });

  try {
    const project = await prisma.project.findUnique({ where: { id: Number(projectId) } });
    if (!project) return res.status(404).json({ error: "Project not found." });

    await prisma.project.update({
      where: { id: Number(projectId) },
      data: {
        dateCreated: dateCreated ? new Date(dateCreated) : project.dateCreated,
        dateDue: dateDue ? new Date(dateDue) : project.dateDue,
        description: description !== undefined ? description : project.description,
        status: status !== undefined ? status : project.status,
        priority: priority !== undefined ? priority : project.priority,
      },
    });

    await appendAuditLog("UPDATE_PROJECT_DETAILS", "project_details", project.code, req.user?.email || "unknown_admin", `Project updated: ${project.name}${status ? ` → ${status}` : ""}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("Error updating project details:", err);
    return res.status(500).json({ error: "Failed to update project details." });
  }
});

router.get("/project-details/:projectId", authenticate, async (req: Request, res: Response) => {
  const projectId = String(req.params.projectId);

  try {
    const project = await prisma.project.findUnique({ where: { id: Number(projectId) } });
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