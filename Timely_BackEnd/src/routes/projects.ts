import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// POST /api/projects — Create a new project
router.post("/projects", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const { projectName, clientName, status, priority, budget, dateCreated, dateDue, description } = req.body || {};

  if (!projectName) return res.status(400).json({ error: "projectName is required." });

  try {
    const project = await prisma.project.create({
      data: {
        code: "TEMP",
        organizationId: orgId,
        name: projectName,
        description: description || "",
        status: status || "Planning",
        priority: priority || "Medium",
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
        consultantProjects: {
          include: { consultant: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    const data = projects.map((p) => {
      const clientNames = p.clientProjects.map((cp) => `${cp.client.firstName} ${cp.client.lastName}`.trim()).join(", ");
      return {
        projectId: String(p.id),
        projectCode: p.code,
        projectName: p.name,
        clientName: clientNames,
        status: p.status,
        priority: p.priority,
        budget: p.budget ? String(p.budget) : "",
        description: p.description,
        startDate: p.dateCreated ? p.dateCreated.toISOString().split("T")[0] : "",
        endDate: p.dateDue ? p.dateDue.toISOString().split("T")[0] : "",
        dateCreated: p.dateCreated ? p.dateCreated.toISOString().split("T")[0] : "",
        dateDue: p.dateDue ? p.dateDue.toISOString().split("T")[0] : "",
        // Property fields
        address: p.address,
        city: p.city,
        state: p.state,
        zip: p.zip,
        propertyType: p.propertyType,
        bedrooms: p.bedrooms ? String(p.bedrooms) : "",
        bathrooms: p.bathrooms,
        sqft: p.sqft ? String(p.sqft) : "",
        lotSize: p.lotSize,
        yearBuilt: p.yearBuilt,
        amenities: p.amenities,
        photos: p.photos,
        videos: p.videos,
        coverPhotoIndex: p.coverPhotoIndex,
        // Listing fields
        listingPrice: p.listingPrice ? String(p.listingPrice) : "",
        listingStatus: p.listingStatus,
        listingSlug: p.listingSlug,
        isPublished: p.isPublished,
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : "",
        // Timestamps
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    });

    return res.json({ data });
  } catch (err) {
    console.error("Error reading projects:", err);
    return res.status(500).json({ error: "Failed to read projects." });
  }
});
// POST /api/project-details — Update project details
router.post("/project-details", authenticate, authorize("owner", "admin", "consultant"), async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const { projectId, dateCreated, dateDue, description, status, priority, name } = req.body || {};

  if (!projectId) return res.status(400).json({ error: "projectId is required." });

  try {
    const project = await prisma.project.findFirst({
      where: { id: Number(projectId), organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found." });

    const data: any = {};
    if (dateCreated !== undefined) data.dateCreated = dateCreated ? new Date(dateCreated) : null;
    if (dateDue !== undefined) data.dateDue = dateDue ? new Date(dateDue) : null;
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;
    if (name !== undefined) data.name = name;

    await prisma.project.update({ where: { id: project.id }, data });

    await appendAuditLog(orgId, "UPDATE_PROJECT", "project", project.code, req.user?.email || "unknown", `Project updated: ${project.name}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("Error updating project:", err);
    return res.status(500).json({ error: "Failed to update project." });
  }
});

// POST /api/projects/:id/property — Save property details
router.post("/projects/:id/property", authenticate, authorize("owner", "admin", "consultant"), async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const projectId = Number(req.params.id);
  const { address, city, state, zip, propertyType, bedrooms, bathrooms, sqft, lotSize, yearBuilt, amenities } = req.body || {};

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found." });

    await prisma.project.update({
      where: { id: projectId },
      data: {
        address: address ?? project.address,
        city: city ?? project.city,
        state: state ?? project.state,
        zip: zip ?? project.zip,
        propertyType: propertyType ?? project.propertyType,
        bedrooms: bedrooms !== undefined ? (bedrooms ? Number(bedrooms) : null) : project.bedrooms,
        bathrooms: bathrooms ?? project.bathrooms,
        sqft: sqft !== undefined ? (sqft ? Number(sqft) : null) : project.sqft,
        lotSize: lotSize ?? project.lotSize,
        yearBuilt: yearBuilt ?? project.yearBuilt,
        amenities: amenities ?? project.amenities,
      },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Error saving property:", err);
    return res.status(500).json({ error: "Failed to save property details." });
  }
});

// POST /api/projects/:id/listing — Save listing details
router.post("/projects/:id/listing", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const projectId = Number(req.params.id);
  const { listingPrice, listingStatus } = req.body || {};

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found." });

    await prisma.project.update({
      where: { id: projectId },
      data: {
        listingPrice: listingPrice ? parseFloat(listingPrice) : project.listingPrice,
        listingStatus: listingStatus ?? project.listingStatus,
      },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Error saving listing:", err);
    return res.status(500).json({ error: "Failed to save listing details." });
  }
});

// POST /api/projects/:id/publish — Toggle publish status
router.post("/projects/:id/publish", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const projectId = Number(req.params.id);

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found." });

    const nowPublished = !project.isPublished;
    const slug = project.listingSlug || project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + String(project.id).slice(-6);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        isPublished: nowPublished,
        publishedAt: nowPublished && !project.publishedAt ? new Date() : project.publishedAt,
        listingSlug: slug,
      },
    });

    return res.json({ success: true, isPublished: nowPublished, listingSlug: slug });
  } catch (err) {
    console.error("Error toggling publish:", err);
    return res.status(500).json({ error: "Failed to toggle publish." });
  }
});

// POST /api/projects/:id/photos — Save photos array
router.post("/projects/:id/photos", authenticate, authorize("owner", "admin", "consultant"), async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const projectId = Number(req.params.id);
  const { photos, coverPhotoIndex } = req.body || {};

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found." });

    const data: any = {};
    if (photos !== undefined) data.photos = photos;
    if (coverPhotoIndex !== undefined) data.coverPhotoIndex = coverPhotoIndex;

    await prisma.project.update({ where: { id: projectId }, data });

    return res.json({ success: true });
  } catch (err) {
    console.error("Error saving photos:", err);
    return res.status(500).json({ error: "Failed to save photos." });
  }
});

// POST /api/projects/:id/videos — Save videos array
router.post("/projects/:id/videos", authenticate, authorize("owner", "admin", "consultant"), async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const projectId = Number(req.params.id);
  const { videos } = req.body || {};

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found." });

    await prisma.project.update({ where: { id: projectId }, data: { videos } });

    return res.json({ success: true });
  } catch (err) {
    console.error("Error saving videos:", err);
    return res.status(500).json({ error: "Failed to save videos." });
  }
});

// DELETE /api/projects/:id — Delete a project
router.delete("/projects/:id", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const projectId = Number(req.params.id);

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found." });

    await prisma.project.delete({ where: { id: project.id } });
    await appendAuditLog(orgId, "DELETE_PROJECT", "project", project.code, req.user?.email || "unknown", `Deleted: ${project.name}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting project:", err);
    return res.status(500).json({ error: "Failed to delete project." });
  }
});

// POST /api/projects/assign — Assign client and consultants
router.post("/projects/assign", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const { clientId, projectId, consultantIds } = req.body || {};

  if (!clientId || !projectId) return res.status(400).json({ error: "clientId and projectId required." });

  try {
    const project = await prisma.project.findFirst({
      where: { id: Number(projectId), organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found." });

    const clientMember = await prisma.orgMember.findFirst({
      where: { userId: Number(clientId), organizationId: orgId, role: "client" },
    });
    if (!clientMember) return res.status(404).json({ error: "Client not found." });

    await prisma.clientProject.upsert({
      where: { clientId_projectId: { clientId: Number(clientId), projectId: Number(projectId) } },
      update: { isCurrent: true },
      create: { clientId: Number(clientId), projectId: Number(projectId), isCurrent: true },
    });

    if (Array.isArray(consultantIds)) {
      for (const cid of consultantIds) {
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

    await appendAuditLog(orgId, "ASSIGN_PROJECT", "assignment", `C${clientId}-P${projectId}`, req.user?.email || "unknown", `Assigned`);
    return res.json({ success: true });
  } catch (err) {
    console.error("Error assigning:", err);
    return res.status(500).json({ error: "Failed to assign." });
  }
});

// GET /api/project-details/:projectId
router.get("/project-details/:projectId", authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const projectId = Number(req.params.projectId);

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
    if (!project) return res.json({ data: null });

    return res.json({
      data: {
        projectId: String(project.id),
        dateCreated: project.dateCreated ? project.dateCreated.toISOString().split("T")[0] : "",
        dateDue: project.dateDue ? project.dateDue.toISOString().split("T")[0] : "",
        description: project.description,
        status: project.status,
        priority: project.priority,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Error reading project details:", err);
    return res.status(500).json({ error: "Failed to read project details." });
  }
});

export default router;