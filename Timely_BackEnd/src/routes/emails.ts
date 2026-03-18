import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// POST /api/emails/send — Send an email (stores in outbox for current org)
router.post("/emails/send", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const { to, from, subject, body } = req.body || {};
  const orgId = req.user!.orgId;

  if (!to || !subject) {
    return res.status(400).json({ error: "to and subject are required." });
  }

  try {
    const email = await prisma.emailOutbox.create({
      data: {
        code: "TEMP",
        organizationId: orgId,
        toEmail: to,
        fromEmail: from || req.user!.email,
        subject,
        body: body || "",
      },
    });

    const code = formatCode("EM", email.id);
    await prisma.emailOutbox.update({
      where: { id: email.id },
      data: { code },
    });

    console.log(`[EMAIL] Mock email sent to ${to}: ${subject}`);

    return res.json({ success: true, emailId: code });
  } catch (err) {
    console.error("Error sending email:", err);
    return res.status(500).json({ error: "Failed to send email." });
  }
});

// GET /api/emails/outbox — List sent emails in current org
router.get("/emails/outbox", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const { limit } = req.query;
  const orgId = req.user!.orgId;
  const maxEmails = Number(limit) || 50;

  try {
    const emails = await prisma.emailOutbox.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: maxEmails,
    });

    const data = emails.map((e) => ({
      emailId: String(e.id),
      emailCode: e.code,
      to: e.toEmail,
      from: e.fromEmail,
      subject: e.subject,
      body: e.body,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
      sentAt: e.sentAt.toISOString(),
    }));

    return res.json({ data });
  } catch (err) {
    console.error("Error reading emails:", err);
    return res.status(500).json({ error: "Failed to read emails." });
  }
});

// GET /api/emails/:emailId — Get a single email in current org
router.get("/emails/:emailId", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const emailId = String(req.params.emailId);
  const orgId = req.user!.orgId;

  try {
    let email = null;
    if (!isNaN(Number(emailId))) {
      email = await prisma.emailOutbox.findFirst({
        where: { id: Number(emailId), organizationId: orgId },
      });
    }
    if (!email) {
      email = await prisma.emailOutbox.findFirst({
        where: { code: emailId, organizationId: orgId },
      });
    }

    if (!email) {
      return res.status(404).json({ error: "Email not found." });
    }

    return res.json({
      data: {
        emailId: String(email.id),
        emailCode: email.code,
        to: email.toEmail,
        from: email.fromEmail,
        subject: email.subject,
        body: email.body,
        status: email.status,
        createdAt: email.createdAt.toISOString(),
        sentAt: email.sentAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Error reading email:", err);
    return res.status(500).json({ error: "Failed to read email." });
  }
});

export default router;