import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// POST /api/client-consultants/assign — Assign consultant to client
router.post("/client-consultants/assign", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  const { clientId, consultantId } = req.body || {};

  if (!clientId || !consultantId) {
    return res.status(400).json({ error: "clientId and consultantId are required." });
  }

  try {
    const client = await prisma.user.findFirst({
      where: { id: Number(clientId), role: "client" },
    });

    const consultant = await prisma.user.findFirst({
      where: { id: Number(consultantId), role: "consultant" },
    });

    if (!client || !consultant) {
      return res.status(400).json({ error: "Client or consultant does not exist." });
    }

    // Check if already assigned
    const existing = await prisma.clientConsultant.findUnique({
      where: {
        clientId_consultantId: {
          clientId: Number(clientId),
          consultantId: Number(consultantId),
        },
      },
    });

    if (existing) {
      return res.json({ success: true, message: "Already assigned." });
    }

    await prisma.clientConsultant.create({
      data: {
        clientId: Number(clientId),
        consultantId: Number(consultantId),
      },
    });

    await appendAuditLog(
      "ASSIGN_CONSULTANT",
      "client_consultant",
      `C${clientId}-CO${consultantId}`,
      req.user?.email || "unknown_admin",
      `Consultant ${consultant.firstName} ${consultant.lastName} assigned to client ${client.firstName} ${client.lastName}`
    );

    // Notify client
    const emailCode = formatCode("EM", Date.now() % 10000);
    await prisma.emailOutbox.create({
      data: {
        code: emailCode,
        toEmail: client.email,
        subject: `Your Consultant: ${consultant.firstName} ${consultant.lastName}`,
        body: `Hi ${client.firstName},\n\n${consultant.firstName} ${consultant.lastName} has been assigned as your consultant.\n\nYou can reach them at: ${consultant.email}\n\nBest regards,\nThe Timely Team`,
      },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Error assigning consultant:", err);
    return res.status(500).json({ error: "Failed to assign consultant." });
  }
});

// GET /api/client-consultants — List assignments
router.get("/client-consultants", authenticate, authorize("admin", "consultant"), async (req: Request, res: Response) => {
  const { clientId, consultantId } = req.query;

  try {
    const where: any = {};
    if (clientId) where.clientId = Number(clientId);
    if (consultantId) where.consultantId = Number(consultantId);

    const assignments = await prisma.clientConsultant.findMany({
      where,
      include: {
        client: { select: { id: true, code: true, firstName: true, lastName: true, email: true } },
        consultant: { select: { id: true, code: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = assignments.map((a) => ({
      clientId: String(a.clientId),
      clientCode: a.client.code,
      clientName: `${a.client.firstName} ${a.client.lastName}`.trim(),
      clientEmail: a.client.email,
      consultantId: String(a.consultantId),
      consultantCode: a.consultant.code,
      consultantName: `${a.consultant.firstName} ${a.consultant.lastName}`.trim(),
      consultantEmail: a.consultant.email,
      createdAt: a.createdAt.toISOString(),
    }));

    return res.json({ data });
  } catch (err) {
    console.error("Error reading assignments:", err);
    return res.status(500).json({ error: "Failed to read assignments." });
  }
});

export default router;