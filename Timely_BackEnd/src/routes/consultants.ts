import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// POST /api/consultants — Create a new consultant in the current org
router.post("/consultants", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const { firstName, lastName, email, tempPassword } = req.body || {};
  const orgId = req.user!.orgId;

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: "firstName, lastName and email are required." });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      const alreadyMember = await prisma.orgMember.findUnique({
        where: { userId_organizationId: { userId: existing.id, organizationId: orgId } },
      });
      if (alreadyMember) {
        return res.status(400).json({ error: "This email is already a member of your organization." });
      }

      await prisma.orgMember.create({
        data: { userId: existing.id, organizationId: orgId, role: "consultant", invitedBy: req.user!.userId },
      });

      await appendAuditLog(
        orgId, "ADD_CONSULTANT", "consultant", existing.code,
        req.user?.email || "unknown",
        `Existing user added as consultant: ${existing.firstName} ${existing.lastName} (${existing.email})`
      );

      return res.json({ success: true, consultantId: existing.id, consultantCode: existing.code });
    }

    const password = tempPassword || "consultant123";
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        code: "TEMP",
        firstName,
        middleName: "",
        lastName,
        email: email.toLowerCase(),
        passwordHash,
      },
    });

    const code = formatCode("CO", user.id);
    await prisma.user.update({ where: { id: user.id }, data: { code } });

    await prisma.orgMember.create({
      data: { userId: user.id, organizationId: orgId, role: "consultant", invitedBy: req.user!.userId },
    });

    await appendAuditLog(
      orgId, "CREATE_CONSULTANT", "consultant", code,
      req.user?.email || "unknown",
      `Consultant created: ${firstName} ${lastName} (${email})`
    );

    await prisma.emailOutbox.create({
      data: {
        code: formatCode("EM", Date.now() % 10000),
        organizationId: orgId,
        toEmail: email,
        subject: "Welcome to Timely - Consultant Account Created",
        body: `Hi ${firstName},\n\nYour consultant account has been created at Timely.\n\nEmail: ${email}\nPassword: ${password}\n\nPlease log in and change your password.\n\nBest regards,\nThe Timely Team`,
      },
    });

    return res.json({ success: true, consultantId: user.id, consultantCode: code });
  } catch (err) {
    console.error("Error creating consultant:", err);
    return res.status(500).json({ error: "Failed to create consultant." });
  }
});

// GET /api/consultants — List all consultants in the current org
router.get("/consultants", authenticate, authorize("owner", "admin", "consultant"), async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;

  try {
    const members = await prisma.orgMember.findMany({
      where: { organizationId: orgId, role: "consultant" },
      include: { user: true },
      orderBy: { user: { id: "asc" } },
    });

    const data = members.map((m) => ({
      consultantId: String(m.user.id),
      consultantCode: m.user.code,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      email: m.user.email,
      tempPassword: "********",
      role: m.role,
    }));

    return res.json({ data });
  } catch (err) {
    console.error("Error reading consultants:", err);
    return res.status(500).json({ error: "Failed to read consultants." });
  }
});

// POST /api/consultants-delete — Remove a consultant from the current org
router.post("/consultants-delete", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const { consultantId } = req.body || {};
  const orgId = req.user!.orgId;

  if (!consultantId) {
    return res.status(400).json({ error: "consultantId is required." });
  }

  try {
    const membership = await prisma.orgMember.findFirst({
      where: { userId: Number(consultantId), organizationId: orgId, role: "consultant" },
      include: { user: true },
    });

    if (!membership) {
      return res.status(404).json({ error: "Consultant not found in this organization." });
    }

    await prisma.orgMember.delete({ where: { id: membership.id } });

    await appendAuditLog(
      orgId, "REMOVE_CONSULTANT", "consultant", membership.user.code,
      req.user?.email || "unknown",
      `Consultant removed: ${membership.user.firstName} ${membership.user.lastName} (${membership.user.email})`
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Error removing consultant:", err);
    return res.status(500).json({ error: "Failed to remove consultant." });
  }
});

export default router;