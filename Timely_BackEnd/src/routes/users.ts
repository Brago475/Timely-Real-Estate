import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/database.js";
import { formatCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// POST /api/users-csv — Create a new client
router.post("/users-csv", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  const { firstName, middleName, lastName, email, tempPassword } = req.body || {};

  if (!firstName || !lastName || !email || !tempPassword) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(400).json({ error: "Email already exists." });
    }

    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        code: "TEMP",
        firstName,
        middleName: middleName || "",
        lastName,
        email: email.toLowerCase(),
        passwordHash,
        role: "client",
      },
    });

    const code = formatCode("C", user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { code },
    });

    await appendAuditLog(
      "CREATE_CLIENT",
      "client",
      code,
      req.user?.email || "unknown_admin",
      `Client created: ${firstName} ${lastName} (${email})`
    );

    const emailCode = formatCode("EM", Date.now() % 10000);
    await prisma.emailOutbox.create({
      data: {
        code: emailCode,
        toEmail: email,
        subject: "Welcome to Timely - Your Account Details",
        body: `Hi ${firstName},\n\nWelcome to Timely! Your account has been created.\n\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease change your password after your first login.\n\nBest regards,\nThe Timely Team`,
      },
    });

    return res.json({ success: true, customerId: user.id, clientCode: code });
  } catch (err) {
    console.error("Error creating client:", err);
    return res.status(500).json({ error: "Failed to create client." });
  }
});

// GET /api/users-report — List all clients
router.get("/users-report", authenticate, authorize("admin", "consultant"), async (req: Request, res: Response) => {
  try {
    const clients = await prisma.user.findMany({
      where: { role: "client" },
      orderBy: { id: "asc" },
    });

    const data = clients.map((c) => ({
      customerId: String(c.id),
      clientCode: c.code,
      firstName: c.firstName,
      middleName: c.middleName,
      lastName: c.lastName,
      email: c.email,
      tempPassword: "********",
    }));

    return res.json({ data });
  } catch (err) {
    console.error("Error reading clients:", err);
    return res.status(500).json({ error: "Failed to read clients." });
  }
});

// POST /api/users-delete — Delete a client
router.post("/users-delete", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  const { customerId } = req.body || {};

  if (!customerId) {
    return res.status(400).json({ error: "customerId is required." });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: Number(customerId), role: "client" },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    await prisma.user.delete({ where: { id: user.id } });

    await appendAuditLog(
      "DELETE_CLIENT",
      "client",
      user.code,
      req.user?.email || "unknown_admin",
      `Client deleted: ${user.firstName} ${user.lastName} (${user.email})`
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting client:", err);
    return res.status(500).json({ error: "Failed to delete client." });
  }
});

// GET /api/users-report/csv — Download clients as CSV
router.get("/users-report/csv", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  try {
    const clients = await prisma.user.findMany({
      where: { role: "client" },
      orderBy: { id: "asc" },
    });

    let csv = "CustomerID,FirstName,MiddleName,LastName,Email\n";
    for (const c of clients) {
      csv += `${c.id},${c.firstName},${c.middleName},${c.lastName},${c.email}\n`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=users.csv");
    return res.send(csv);
  } catch (err) {
    console.error("Error exporting clients:", err);
    return res.status(500).json({ error: "Failed to export clients." });
  }
});

export default router;