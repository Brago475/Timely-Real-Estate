import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// POST /api/client-consultants/assign — Assign consultant to client
router.post("/client-consultants/assign", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const { clientId, consultantId } = req.body || {};
  const orgId = req.user!.orgId;

  if (!clientId || !consultantId) {
    return res.status(400).json({ error: "clientId and consultantId are required." });
  }

  try {
    // Verify both are members of this org with correct roles
    const clientMember = await prisma.orgMember.findFirst({
      where: { userId: Number(clientId), organizationId: orgId, role: "client" },
      include: { user: true },
    });

    const consultantMember = await prisma.orgMember.findFirst({
      where: { userId: Number(consultantId), organizationId: orgId, role: "consultant" },
      include: { user: true },
    });

    if (!clientMember || !consultantMember) {
      return res.status(400).json({ error: "Client or consultant not found in this organization." });
    }

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
      orgId,
      "ASSIGN_CONSULTANT",
      "client_consultant",
      `C${clientId}-CO${consultantId}`,
      req.user?.email || "unknown",
      `Consultant ${consultantMember.user.firstName} ${consultantMember.user.lastName} assigned to client ${clientMember.user.firstName} ${clientMember.user.lastName}`
    );

    await prisma.emailOutbox.create({
      data: {
        code: formatCode("EM", Date.now() % 10000),
        organizationId: orgId,
        toEmail: clientMember.user.email,
        subject: `Your Consultant: ${consultantMember.user.firstName} ${consultantMember.user.lastName}`,
        body: `Hi ${clientMember.user.firstName},\n\n${consultantMember.user.firstName} ${consultantMember.user.lastName} has been assigned as your consultant.\n\nYou can reach them at: ${consultantMember.user.email}\n\nBest regards,\nThe Timely Team`,
      },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Error assigning consultant:", err);
    return res.status(500).json({ error: "Failed to assign consultant." });
  }
});

// GET /api/client-consultants — List assignments in the current org
router.get("/client-consultants", authenticate, authorize("owner", "admin", "consultant"), async (req: Request, res: Response) => {
  const { clientId, consultantId } = req.query;
  const orgId = req.user!.orgId;

  try {
    // Get all client and consultant user IDs in this org
    const orgClients = await prisma.orgMember.findMany({
      where: { organizationId: orgId, role: "client" },
      select: { userId: true },
    });
    const orgConsultants = await prisma.orgMember.findMany({
      where: { organizationId: orgId, role: "consultant" },
      select: { userId: true },
    });

    const clientIds = orgClients.map((m) => m.userId);
    const consultantIds = orgConsultants.map((m) => m.userId);

    const where: any = {
      clientId: { in: clientIds },
      consultantId: { in: consultantIds },
    };
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