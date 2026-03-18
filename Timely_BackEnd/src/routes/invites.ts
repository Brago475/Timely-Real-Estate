import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/database.js";
import { userCode } from "../config/codes.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { generateToken } from "../middleware/auth.js";

const router = Router();

// POST /api/invites — Create an invite (owner/admin only)
router.post("/invites", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const { email, role } = req.body || {};
  const orgId = req.user!.orgId;

  if (!email || !role) {
    return res.status(400).json({ error: "email and role are required." });
  }

  const validRoles = ["admin", "consultant", "client"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "role must be admin, consultant, or client." });
  }

  try {
    // Check if user is already a member of this org
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      const alreadyMember = await prisma.orgMember.findUnique({
        where: { userId_organizationId: { userId: existingUser.id, organizationId: orgId } },
      });
      if (alreadyMember) {
        return res.status(400).json({ error: "This person is already a member of your organization." });
      }
    }

    // Check for existing unused invite
    const existingInvite = await prisma.invite.findFirst({
      where: {
        email: email.toLowerCase(),
        organizationId: orgId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvite) {
      return res.status(400).json({ error: "An active invite already exists for this email." });
    }

    // Create invite (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await prisma.invite.create({
      data: {
        email: email.toLowerCase(),
        organizationId: orgId,
        role,
        invitedBy: req.user!.userId,
        expiresAt,
      },
    });

    // Send invite email
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    const inviteUrl = `${process.env.APP_URL || "http://localhost"}/invite/${invite.token}`;

    await prisma.emailOutbox.create({
      data: {
        code: formatCode("EM", Date.now() % 10000),
        organizationId: orgId,
        toEmail: email,
        fromEmail: req.user!.email,
        subject: `You've been invited to ${org?.name || "Timely"}`,
        body: `Hi,\n\nYou've been invited to join ${org?.name || "an organization"} on Timely as a ${role}.\n\nClick the link below to accept:\n${inviteUrl}\n\nThis link expires in 7 days.\n\nBest regards,\nThe Timely Team`,
      },
    });

    await appendAuditLog(
      orgId, "SEND_INVITE", "invite", invite.token.slice(0, 8),
      req.user?.email || "unknown",
      `Invite sent to ${email} as ${role}`
    );

    return res.json({
      success: true,
      inviteId: invite.id,
      token: invite.token,
      inviteUrl,
    });
  } catch (err) {
    console.error("Error creating invite:", err);
    return res.status(500).json({ error: "Failed to create invite." });
  }
});

// GET /api/invites — List pending invites for current org
router.get("/invites", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;

  try {
    const invites = await prisma.invite.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      include: {
        inviter: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    const data = invites.map((i) => ({
      inviteId: i.id,
      email: i.email,
      role: i.role,
      invitedBy: `${i.inviter.firstName} ${i.inviter.lastName}`.trim(),
      inviterEmail: i.inviter.email,
      status: i.usedAt ? "accepted" : i.expiresAt < new Date() ? "expired" : "pending",
      createdAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
      usedAt: i.usedAt?.toISOString() || null,
    }));

    return res.json({ data });
  } catch (err) {
    console.error("Error reading invites:", err);
    return res.status(500).json({ error: "Failed to read invites." });
  }
});

// DELETE /api/invites/:inviteId — Revoke a pending invite
router.delete("/invites/:inviteId", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const { inviteId } = req.params;
  const orgId = req.user!.orgId;

  try {
    const invite = await prisma.invite.findFirst({
      where: { id: Number(inviteId), organizationId: orgId, usedAt: null },
    });

    if (!invite) {
      return res.status(404).json({ error: "Invite not found or already used." });
    }

    await prisma.invite.delete({ where: { id: invite.id } });

    await appendAuditLog(
      orgId, "REVOKE_INVITE", "invite", invite.token.slice(0, 8),
      req.user?.email || "unknown",
      `Invite revoked for ${invite.email}`
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Error revoking invite:", err);
    return res.status(500).json({ error: "Failed to revoke invite." });
  }
});

// GET /api/invites/verify/:token — Verify an invite token (public, no auth)
router.get("/invites/verify/:token", async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { organization: { select: { name: true, slug: true } } },
    });

    if (!invite) {
      return res.status(404).json({ error: "Invite not found." });
    }

    if (invite.usedAt) {
      return res.status(400).json({ error: "This invite has already been used." });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ error: "This invite has expired." });
    }

    return res.json({
      data: {
        email: invite.email,
        role: invite.role,
        orgName: invite.organization.name,
        orgSlug: invite.organization.slug,
      },
    });
  } catch (err) {
    console.error("Error verifying invite:", err);
    return res.status(500).json({ error: "Failed to verify invite." });
  }
});

// POST /api/invites/accept/:token — Accept invite and create account (public, no auth)
router.post("/invites/accept/:token", async (req: Request, res: Response) => {
  const { token } = req.params;
  const { firstName, lastName, password } = req.body || {};

  if (!firstName || !lastName || !password) {
    return res.status(400).json({ error: "firstName, lastName, and password are required." });
  }

  try {
    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invite) {
      return res.status(404).json({ error: "Invite not found." });
    }

    if (invite.usedAt) {
      return res.status(400).json({ error: "This invite has already been used." });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ error: "This invite has expired." });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Check if user already exists (might have account from another org)
    let user = await prisma.user.findUnique({ where: { email: invite.email } });

    if (user) {
      // Make sure not already in this org
      const alreadyMember = await prisma.orgMember.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId: invite.organizationId } },
      });
      if (alreadyMember) {
        return res.status(400).json({ error: "You are already a member of this organization." });
      }
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          code: "TEMP",
          firstName,
          lastName,
          email: invite.email,
          passwordHash,
        },
      });

      const code = userCode(invite.role, user.id);
      await prisma.user.update({ where: { id: user.id }, data: { code } });
      user.code = code;
    }

    // Link to org
    await prisma.orgMember.create({
      data: {
        userId: user.id,
        organizationId: invite.organizationId,
        role: invite.role,
        invitedBy: invite.invitedBy,
      },
    });

    // Mark invite as used
    await prisma.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    await appendAuditLog(
      invite.organizationId, "ACCEPT_INVITE", "invite", invite.token.slice(0, 8),
      invite.email,
      `Invite accepted: ${firstName} ${lastName} joined as ${invite.role}`
    );

    // Auto-login: return a token
    const authToken = generateToken({
      userId: user.id,
      email: user.email,
      orgId: invite.organizationId,
      role: invite.role,
      code: user.code,
    });

    return res.json({
      success: true,
      token: authToken,
      user: {
        customerId: String(user.id),
        name: `${firstName} ${lastName}`.trim(),
        email: user.email,
        role: invite.role,
        orgId: invite.organizationId,
        orgName: invite.organization.name,
        orgSlug: invite.organization.slug,
      },
    });
  } catch (err) {
    console.error("Error accepting invite:", err);
    return res.status(500).json({ error: "Failed to accept invite." });
  }
});

export default router;