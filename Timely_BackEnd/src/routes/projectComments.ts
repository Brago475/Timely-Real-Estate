import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// POST /api/project-comments — Add a comment (project must belong to current org)
router.post("/project-comments", authenticate, async (req: Request, res: Response) => {
  const { projectId, author, commentText } = req.body || {};
  const orgId = req.user!.orgId;

  if (!projectId || !commentText) {
    return res.status(400).json({ error: "projectId and commentText are required." });
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: Number(projectId), organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found in this organization." });

    const comment = await prisma.projectComment.create({
      data: {
        code: "TEMP",
        projectId: Number(projectId),
        authorId: req.user!.userId,
        commentText,
      },
    });

    const code = formatCode("CM", comment.id);
    await prisma.projectComment.update({
      where: { id: comment.id },
      data: { code },
    });

    await appendAuditLog(
      orgId, "CREATE_COMMENT", "comment", code,
      req.user?.email || author || "unknown",
      `Comment added to project ${projectId}`
    );

    return res.json({ success: true, commentId: comment.id, commentCode: code });
  } catch (err) {
    console.error("Error creating comment:", err);
    return res.status(500).json({ error: "Failed to create comment." });
  }
});

// GET /api/project-comments/:projectId — Get comments for a project in current org
router.get("/project-comments/:projectId", authenticate, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = req.user!.orgId;

  try {
    const project = await prisma.project.findFirst({
      where: { id: Number(projectId), organizationId: orgId },
    });
    if (!project) return res.status(404).json({ error: "Project not found in this organization." });

    const comments = await prisma.projectComment.findMany({
      where: { projectId: Number(projectId) },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: {
            id: true, firstName: true, lastName: true, email: true,
            memberships: {
              where: { organizationId: orgId },
              select: { role: true },
            },
          },
        },
      },
    });

    const data = comments.map((c) => ({
      commentId: String(c.id),
      commentCode: c.code,
      projectId: String(c.projectId),
      author: `${c.author.firstName} ${c.author.lastName}`.trim(),
      authorEmail: c.author.email,
      authorRole: c.author.memberships[0]?.role || "unknown",
      commentText: c.commentText,
      createdAt: c.createdAt.toISOString(),
    }));

    return res.json({ data });
  } catch (err) {
    console.error("Error reading comments:", err);
    return res.status(500).json({ error: "Failed to read comments." });
  }
});

export default router;