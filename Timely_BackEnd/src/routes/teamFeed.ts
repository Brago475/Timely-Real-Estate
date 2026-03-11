import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// POST /api/team-feed — Create a post
router.post("/team-feed", authenticate, async (req: Request, res: Response) => {
  const { content } = req.body || {};

  if (!content) {
    return res.status(400).json({ error: "content is required." });
  }

  try {
    const post = await prisma.teamFeedPost.create({
      data: {
        code: "TEMP",
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
      "CREATE_POST",
      "team_feed",
      code,
      req.user?.email || "unknown",
      `Team feed post created`
    );

    // Fetch author info for response
    const author = await prisma.user.findUnique({ where: { id: req.user!.userId } });

    return res.json({
      success: true,
      postId: post.id,
      postCode: code,
      post: {
        postId: String(post.id),
        authorName: author ? `${author.firstName} ${author.lastName}`.trim() : "",
        authorEmail: author?.email || "",
        authorRole: author?.role || "staff",
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

// GET /api/team-feed — List posts
router.get("/team-feed", authenticate, async (req: Request, res: Response) => {
  const { limit } = req.query;
  const maxPosts = Number(limit) || 50;

  try {
    const posts = await prisma.teamFeedPost.findMany({
      orderBy: { createdAt: "desc" },
      take: maxPosts,
      include: {
        author: { select: { firstName: true, lastName: true, email: true, role: true } },
        likes: { select: { userId: true } },
      },
    });

    const data = posts.map((p) => ({
      postId: String(p.id),
      postCode: p.code,
      authorName: `${p.author.firstName} ${p.author.lastName}`.trim(),
      authorEmail: p.author.email,
      authorRole: p.author.role,
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

// POST /api/team-feed/:postId/like — Like a post
router.post("/team-feed/:postId/like", authenticate, async (req: Request, res: Response) => {
  const { postId } = req.params;

  try {
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

// POST /api/team-feed/:postId/unlike — Unlike a post
router.post("/team-feed/:postId/unlike", authenticate, async (req: Request, res: Response) => {
  const { postId } = req.params;

  try {
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

// POST /api/team-feed/:postId/delete — Delete a post
router.post("/team-feed/:postId/delete", authenticate, async (req: Request, res: Response) => {
  const { postId } = req.params;

  try {
    const post = await prisma.teamFeedPost.findUnique({
      where: { id: Number(postId) },
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found." });
    }

    // Only author or admin can delete
    if (post.authorId !== req.user!.userId && req.user!.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to delete this post." });
    }

    await prisma.teamFeedPost.delete({ where: { id: Number(postId) } });

    await appendAuditLog(
      "DELETE_POST",
      "team_feed",
      post.code,
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