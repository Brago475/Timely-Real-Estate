import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// POST /api/project-attachments — Upload attachment metadata (project must belong to current org)
router.post("/project-attachments", authenticate, async (req: Request, res: Response) => {
  const { projectId, fileName, fileSize, fileType } = req.body || {};
  const orgId = req.user!.orgId;

  if (!projectId || !fileName) {
    return res.status(400).json({ error: "projectId and fileName are required." });
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: Number(projectId), organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found in this organization." });

    const attachment = await prisma.projectAttachment.create({
      data: {
        code: "TEMP",
        projectId: Number(projectId),
        fileName,
        fileSize: fileSize || "",
        fileType: fileType || "",
        uploadedBy: req.user!.userId,
      },
    });

    const code = formatCode("AT", attachment.id);
    await prisma.projectAttachment.update({
      where: { id: attachment.id },
      data: { code },
    });

    await appendAuditLog(
      orgId, "UPLOAD_ATTACHMENT", "attachment", code,
      req.user?.email || "unknown",
      `File uploaded: ${fileName} to project ${projectId}`
    );

    return res.json({ success: true, attachmentId: attachment.id, attachmentCode: code });
  } catch (err) {
    console.error("Error creating attachment:", err);
    return res.status(500).json({ error: "Failed to create attachment." });
  }
});

// GET /api/project-attachments/:projectId — Get attachments for a project in current org
router.get("/project-attachments/:projectId", authenticate, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = req.user!.orgId;

  try {
    const project = await prisma.project.findFirst({
      where: { id: Number(projectId), organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found in this organization." });

    const attachments = await prisma.projectAttachment.findMany({
      where: { projectId: Number(projectId) },
      orderBy: { createdAt: "desc" },
      include: {
        uploader: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    const data = attachments.map((a) => ({
      attachmentId: String(a.id),
      attachmentCode: a.code,
      projectId: String(a.projectId),
      fileName: a.fileName,
      fileSize: a.fileSize,
      fileType: a.fileType,
      uploadedBy: a.uploader ? `${a.uploader.firstName} ${a.uploader.lastName}`.trim() : "",
      uploaderEmail: a.uploader?.email || "",
      fileUrl: a.fileUrl,
      createdAt: a.createdAt.toISOString(),
    }));

    return res.json({ data });
  } catch (err) {
    console.error("Error reading attachments:", err);
    return res.status(500).json({ error: "Failed to read attachments." });
  }
});

export default router;