import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// POST /api/consultants — Create a new consultant
router.post("/consultants", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  const { firstName, lastName, email, tempPassword, role: consultantRole } = req.body || {};

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: "firstName, lastName and email are required." });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(400).json({ error: "Email already exists." });
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
        role: "consultant",
      },
    });

    const code = formatCode("CO", user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { code },
    });

    await appendAuditLog(
      "CREATE_CONSULTANT",
      "consultant",
      code,
      req.user?.email || "unknown_admin",
      `Consultant created: ${firstName} ${lastName} (${email})`
    );

    const emailCode = formatCode("EM", Date.now() % 10000);
    await prisma.emailOutbox.create({
      data: {
        code: emailCode,
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

// GET /api/consultants — List all consultants
router.get("/consultants", authenticate, authorize("admin", "consultant"), async (req: Request, res: Response) => {
  try {
    const consultants = await prisma.user.findMany({
      where: { role: "consultant" },
      orderBy: { id: "asc" },
    });

    const data = consultants.map((c) => ({
      consultantId: String(c.id),
      consultantCode: c.code,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      tempPassword: "********",
      role: c.role,
    }));

    return res.json({ data });
  } catch (err) {
    console.error("Error reading consultants:", err);
    return res.status(500).json({ error: "Failed to read consultants." });
  }
});

// POST /api/consultants-delete — Delete a consultant
router.post("/consultants-delete", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  const { consultantId } = req.body || {};

  if (!consultantId) {
    return res.status(400).json({ error: "consultantId is required." });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: Number(consultantId), role: "consultant" },
    });

    if (!user) {
      return res.status(404).json({ error: "Consultant not found." });
    }

    await prisma.user.delete({ where: { id: user.id } });

    await appendAuditLog(
      "DELETE_CONSULTANT",
      "consultant",
      user.code,
      req.user?.email || "unknown_admin",
      `Consultant deleted: ${user.firstName} ${user.lastName} (${user.email})`
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting consultant:", err);
    return res.status(500).json({ error: "Failed to delete consultant." });
  }
});

export default router;