import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// POST /api/project-comments — Add a comment
router.post("/project-comments", authenticate, async (req: Request, res: Response) => {
  const { projectId, author, commentText } = req.body || {};

  if (!projectId || !commentText) {
    return res.status(400).json({ error: "projectId and commentText are required." });
  }

  try {
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
      "CREATE_COMMENT",
      "comment",
      code,
      req.user?.email || author || "unknown",
      `Comment added to project ${projectId}`
    );

    return res.json({ success: true, commentId: comment.id, commentCode: code });
  } catch (err) {
    console.error("Error creating comment:", err);
    return res.status(500).json({ error: "Failed to create comment." });
  }
});

// GET /api/project-comments/:projectId — Get comments for a project
router.get("/project-comments/:projectId", authenticate, async (req: Request, res: Response) => {
  const { projectId } = req.params;

  try {
    const comments = await prisma.projectComment.findMany({
      where: { projectId: Number(projectId) },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { firstName: true, lastName: true, email: true, role: true } },
      },
    });

    const data = comments.map((c) => ({
      commentId: String(c.id),
      commentCode: c.code,
      projectId: String(c.projectId),
      author: `${c.author.firstName} ${c.author.lastName}`.trim(),
      authorEmail: c.author.email,
      authorRole: c.author.role,
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