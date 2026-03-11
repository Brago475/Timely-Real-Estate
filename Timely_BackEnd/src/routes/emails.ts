import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// POST /api/emails/send — Send an email (stores in outbox)
router.post("/emails/send", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  const { to, from, subject, body } = req.body || {};

  if (!to || !subject) {
    return res.status(400).json({ error: "to and subject are required." });
  }

  try {
    const email = await prisma.emailOutbox.create({
      data: {
        code: "TEMP",
        toEmail: to,
        fromEmail: from || "noreply@timely.com",
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

// GET /api/emails/outbox — List sent emails
router.get("/emails/outbox", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  const { limit } = req.query;
  const maxEmails = Number(limit) || 50;

  try {
    const emails = await prisma.emailOutbox.findMany({
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

// GET /api/emails/:emailId — Get a single email
router.get("/emails/:emailId", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  const { emailId } = req.params;

  try {
    let email = null;
    if (!isNaN(Number(emailId))) {
      email = await prisma.emailOutbox.findUnique({ where: { id: Number(emailId) } });
    }
    if (!email) {
      email = await prisma.emailOutbox.findFirst({ where: { code: emailId } });
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