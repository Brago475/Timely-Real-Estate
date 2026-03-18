import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// POST /api/conversations — Create a conversation (direct or project-linked)
router.post("/conversations", authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const userId = req.user!.userId;
  const { recipientId, projectId, title } = req.body || {};

  if (!recipientId) {
    return res.status(400).json({ error: "recipientId is required." });
  }

  try {
    // Verify recipient is in the same org
    const recipientMember = await prisma.orgMember.findFirst({
      where: { userId: Number(recipientId), organizationId: orgId },
    });
    if (!recipientMember) {
      return res.status(404).json({ error: "Recipient not found in this organization." });
    }

    // Check if a direct conversation already exists between these two users
    if (!projectId) {
      const existing = await prisma.conversation.findFirst({
        where: {
          organizationId: orgId,
          type: "direct",
          projectId: null,
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: Number(recipientId) } } },
          ],
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      });

      if (existing) {
        return res.json({ success: true, conversation: formatConversation(existing, userId) });
      }
    }

    // Create new conversation
    const recipient = await prisma.user.findUnique({ where: { id: Number(recipientId) } });
    const convTitle = title || `${recipient?.firstName} ${recipient?.lastName}`;

    const conversation = await prisma.conversation.create({
      data: {
        organizationId: orgId,
        projectId: projectId ? Number(projectId) : null,
        title: convTitle,
        type: projectId ? "project" : "direct",
        createdBy: userId,
        members: {
          create: [
            { userId },
            { userId: Number(recipientId) },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    return res.json({ success: true, conversation: formatConversation(conversation, userId) });
  } catch (err) {
    console.error("Error creating conversation:", err);
    return res.status(500).json({ error: "Failed to create conversation." });
  }
});

// GET /api/conversations — List my conversations
router.get("/conversations", authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const userId = req.user!.userId;

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        organizationId: orgId,
        members: { some: { userId } },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true, firstName: true, lastName: true, email: true,
                memberships: {
                  where: { organizationId: orgId },
                  select: { role: true },
                },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const data = conversations.map((conv) => {
      const myMembership = conv.members.find((m) => m.userId === userId);
      const otherMembers = conv.members.filter((m) => m.userId !== userId);
      const lastMsg = conv.messages[0] || null;

      // Count unread: messages created after my lastReadAt
      const unreadCount = lastMsg && myMembership
        ? (new Date(lastMsg.createdAt) > new Date(myMembership.lastReadAt) ? 1 : 0)
        : 0;

      return {
        conversationId: conv.id,
        title: conv.title,
        type: conv.type,
        projectId: conv.projectId,
        participants: otherMembers.map((m) => ({
          userId: m.user.id,
          name: `${m.user.firstName} ${m.user.lastName}`.trim(),
          email: m.user.email,
          role: m.user.memberships[0]?.role || "unknown",
        })),
        lastMessage: lastMsg ? {
          body: lastMsg.body.substring(0, 100),
          senderName: `${lastMsg.sender.firstName} ${lastMsg.sender.lastName}`.trim(),
          senderId: lastMsg.sender.id,
          createdAt: lastMsg.createdAt.toISOString(),
        } : null,
        unreadCount,
        updatedAt: conv.updatedAt.toISOString(),
        createdAt: conv.createdAt.toISOString(),
      };
    });

    return res.json({ data });
  } catch (err) {
    console.error("Error listing conversations:", err);
    return res.status(500).json({ error: "Failed to list conversations." });
  }
});

// GET /api/conversations/:id/messages — Get messages for a conversation
router.get("/conversations/:id/messages", authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const userId = req.user!.userId;
  const conversationId = Number(req.params.id);
  const limit = Number(req.query.limit) || 50;
  const before = req.query.before ? String(req.query.before) : undefined;

  try {
    // Verify user is a member of this conversation
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) {
      return res.status(403).json({ error: "Not a member of this conversation." });
    }

    const where: any = { conversationId };
    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    const messages = await prisma.directMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        sender: {
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

    // Reverse so oldest first
    const data = messages.reverse().map((msg) => ({
      messageId: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.sender.id,
      senderName: `${msg.sender.firstName} ${msg.sender.lastName}`.trim(),
      senderEmail: msg.sender.email,
      senderRole: msg.sender.memberships[0]?.role || "unknown",
      body: msg.body,
      type: msg.type,
      createdAt: msg.createdAt.toISOString(),
      isOwn: msg.sender.id === userId,
    }));

    return res.json({ data });
  } catch (err) {
    console.error("Error reading messages:", err);
    return res.status(500).json({ error: "Failed to read messages." });
  }
});

// POST /api/conversations/:id/messages — Send a message
router.post("/conversations/:id/messages", authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const userId = req.user!.userId;
  const conversationId = Number(req.params.id);
  const { body, type } = req.body || {};

  if (!body || !body.trim()) {
    return res.status(400).json({ error: "Message body is required." });
  }

  try {
    // Verify user is a member
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) {
      return res.status(403).json({ error: "Not a member of this conversation." });
    }

    // Verify conversation belongs to this org
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId: orgId },
    });
    if (!conv) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const message = await prisma.directMessage.create({
      data: {
        conversationId,
        senderId: userId,
        body: body.trim(),
        type: type || "text",
      },
      include: {
        sender: {
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

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Update sender's lastReadAt
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });

    return res.json({
      success: true,
      message: {
        messageId: message.id,
        conversationId: message.conversationId,
        senderId: message.sender.id,
        senderName: `${message.sender.firstName} ${message.sender.lastName}`.trim(),
        senderEmail: message.sender.email,
        senderRole: message.sender.memberships[0]?.role || "unknown",
        body: message.body,
        type: message.type,
        createdAt: message.createdAt.toISOString(),
        isOwn: true,
      },
    });
  } catch (err) {
    console.error("Error sending message:", err);
    return res.status(500).json({ error: "Failed to send message." });
  }
});

// POST /api/conversations/:id/read — Mark conversation as read
router.post("/conversations/:id/read", authenticate, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const conversationId = Number(req.params.id);

  try {
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Error marking read:", err);
    return res.status(500).json({ error: "Failed to mark as read." });
  }
});

// GET /api/conversations/contacts — Get all org members I can message
router.get("/conversations/contacts", authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const userId = req.user!.userId;

  try {
    const members = await prisma.orgMember.findMany({
      where: { organizationId: orgId, userId: { not: userId } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { role: "asc" },
    });

    const data = members.map((m) => ({
      userId: m.user.id,
      name: `${m.user.firstName} ${m.user.lastName}`.trim(),
      email: m.user.email,
      role: m.role === "owner" ? "admin" : m.role,
      actualRole: m.role,
    }));

    return res.json({ data });
  } catch (err) {
    console.error("Error loading contacts:", err);
    return res.status(500).json({ error: "Failed to load contacts." });
  }
});

// Helper to format conversation for response
function formatConversation(conv: any, currentUserId: number) {
  const otherMembers = conv.members.filter((m: any) => m.userId !== currentUserId);
  return {
    conversationId: conv.id,
    title: conv.title,
    type: conv.type,
    projectId: conv.projectId,
    participants: otherMembers.map((m: any) => ({
      userId: m.user.id,
      name: `${m.user.firstName} ${m.user.lastName}`.trim(),
      email: m.user.email,
    })),
    updatedAt: conv.updatedAt.toISOString(),
    createdAt: conv.createdAt.toISOString(),
  };
}

export default router;