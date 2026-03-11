import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/database.js";
import { generateToken } from "../middleware/auth.js";
import { appendAuditLog } from "../config/audit.js";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      code: user.code,
    });

    await appendAuditLog(
      "LOGIN",
      user.role,
      user.code,
      user.email,
      `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} logged in: ${user.firstName} ${user.lastName}`
    );

    const response: any = {
      success: true,
      token,
      user: {
        customerId: String(user.id),
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        role: user.role,
      },
    };

    if (user.role === "client") {
      response.user.clientCode = user.code;
    } else if (user.role === "consultant") {
      response.user.consultantCode = user.code;
    }

    return res.json(response);
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error during login." });
  }
});

export default router;