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
      include: {
        memberships: {
          include: { organization: true },
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // User must belong to at least one org
    if (user.memberships.length === 0) {
      return res.status(403).json({ error: "No organization found for this account." });
    }

    // Default to first org (multi-org switching can be added later)
    const membership = user.memberships[0];
    const role = membership.role;
    const orgId = membership.organizationId;

    const token = generateToken({
      userId: user.id,
      email: user.email,
      orgId,
      role,
      code: user.code,
    });

    await appendAuditLog(
      orgId,
      "LOGIN",
      role,
      user.code,
      user.email,
      `${role.charAt(0).toUpperCase() + role.slice(1)} logged in: ${user.firstName} ${user.lastName}`
    );

    const response: any = {
      success: true,
      token,
      user: {
        customerId: String(user.id),
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        role,
        orgId,
        orgName: membership.organization.name,
        orgSlug: membership.organization.slug,
      },
    };

    if (role === "client") {
      response.user.clientCode = user.code;
    } else if (role === "consultant") {
      response.user.consultantCode = user.code;
    }

    return res.json(response);
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error during login." });
  }
});

export default router;