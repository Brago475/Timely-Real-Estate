import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// POST /api/team-feed — Create a post in the current org
router.post("/team-feed", authenticate, async (req: Request, res: Response) => {
  const { content } = req.body || {};
  const orgId = req.user!.orgId;

  if (!content) {
    return res.status(400).json({ error: "content is required." });
  }

  try {
    const post = await prisma.teamFeedPost.create({
      data: {
        code: "TEMP",
        organizationId: orgId,
        authorId: req.user!.userId,
        content,
      },
    });

    const code = formatCode("TF", post.id);
    await prisma.teamFeedPost.update({
      where: { id: post.id },
      data: { code },
    });

    await appendAuditLog(
      orgId, "CREATE_POST", "team_feed", code,
      req.user?.email || "unknown",
      `Team feed post created`
    );

    // Fetch author info + role in this org
    const author = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        memberships: {
          where: { organizationId: orgId },
          select: { role: true },
        },
      },
    });

    return res.json({
      success: true,
      postId: post.id,
      postCode: code,
      post: {
        postId: String(post.id),
        authorName: author ? `${author.firstName} ${author.lastName}`.trim() : "",
        authorEmail: author?.email || "",
        authorRole: author?.memberships[0]?.role || "staff",
        content,
        createdAt: post.createdAt.toISOString(),
        likes: 0,
        likedByUser: false,
      },
    });
  } catch (err) {
    console.error("Error creating post:", err);
    return res.status(500).json({ error: "Failed to create post." });
  }
});

// GET /api/team-feed — List posts in current org
router.get("/team-feed", authenticate, async (req: Request, res: Response) => {
  const { limit } = req.query;
  const orgId = req.user!.orgId;
  const maxPosts = Number(limit) || 50;

  try {
    const posts = await prisma.teamFeedPost.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: maxPosts,
      include: {
        author: {
          select: {
            firstName: true, lastName: true, email: true,
            memberships: {
              where: { organizationId: orgId },
              select: { role: true },
            },
          },
        },
        likes: { select: { userId: true } },
      },
    });

    const data = posts.map((p) => ({
      postId: String(p.id),
      postCode: p.code,
      authorName: `${p.author.firstName} ${p.author.lastName}`.trim(),
      authorEmail: p.author.email,
      authorRole: p.author.memberships[0]?.role || "staff",
      content: p.content,
      createdAt: p.createdAt.toISOString(),
      likes: p.likes.length,
      likedByUser: p.likes.some((l) => l.userId === req.user!.userId),
    }));

    return res.json({ data });
  } catch (err) {
    console.error("Error reading team feed:", err);
    return res.status(500).json({ error: "Failed to read team feed." });
  }
});

// POST /api/team-feed/:postId/like — Like a post in current org
router.post("/team-feed/:postId/like", authenticate, async (req: Request, res: Response) => {
  const { postId } = req.params;
  const orgId = req.user!.orgId;

  try {
    // Verify post belongs to this org
    const post = await prisma.teamFeedPost.findFirst({
      where: { id: Number(postId), organizationId: orgId },
    });
    if (!post) return res.status(404).json({ error: "Post not found in this organization." });

    const existing = await prisma.teamFeedLike.findUnique({
      where: {
        postId_userId: {
          postId: Number(postId),
          userId: req.user!.userId,
        },
      },
    });

    if (existing) {
      const count = await prisma.teamFeedLike.count({ where: { postId: Number(postId) } });
      return res.json({ success: true, message: "Already liked.", likes: count });
    }

    await prisma.teamFeedLike.create({
      data: {
        postId: Number(postId),
        userId: req.user!.userId,
      },
    });

    const count = await prisma.teamFeedLike.count({ where: { postId: Number(postId) } });
    return res.json({ success: true, likes: count });
  } catch (err) {
    console.error("Error liking post:", err);
    return res.status(500).json({ error: "Failed to like post." });
  }
});

// POST /api/team-feed/:postId/unlike — Unlike a post in current org
router.post("/team-feed/:postId/unlike", authenticate, async (req: Request, res: Response) => {
  const { postId } = req.params;
  const orgId = req.user!.orgId;

  try {
    const post = await prisma.teamFeedPost.findFirst({
      where: { id: Number(postId), organizationId: orgId },
    });
    if (!post) return res.status(404).json({ error: "Post not found in this organization." });

    await prisma.teamFeedLike.deleteMany({
      where: {
        postId: Number(postId),
        userId: req.user!.userId,
      },
    });

    const count = await prisma.teamFeedLike.count({ where: { postId: Number(postId) } });
    return res.json({ success: true, likes: count });
  } catch (err) {
    console.error("Error unliking post:", err);
    return res.status(500).json({ error: "Failed to unlike post." });
  }
});

// POST /api/team-feed/:postId/delete — Delete a post (author or owner/admin only)
router.post("/team-feed/:postId/delete", authenticate, async (req: Request, res: Response) => {
  const { postId } = req.params;
  const orgId = req.user!.orgId;

  try {
    const post = await prisma.teamFeedPost.findFirst({
      where: { id: Number(postId), organizationId: orgId },
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found in this organization." });
    }

    // Only author, owner, or admin can delete
    const role = req.user!.role;
    if (post.authorId !== req.user!.userId && role !== "admin" && role !== "owner") {
      return res.status(403).json({ error: "Not authorized to delete this post." });
    }

    await prisma.teamFeedPost.delete({ where: { id: post.id } });

    await appendAuditLog(
      orgId, "DELETE_POST", "team_feed", post.code,
      req.user?.email || "unknown",
      `Team feed post deleted`
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting post:", err);
    return res.status(500).json({ error: "Failed to delete post." });
  }
});

export default router;