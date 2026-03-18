import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/database.js";
import { userCode } from "../config/codes.js";
import { appendAuditLog } from "../config/audit.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { generateToken } from "../middleware/auth.js";

const router = Router();

// POST /api/orgs/signup — Business owner creates account + organization
router.post("/orgs/signup", async (req: Request, res: Response) => {
  const { firstName, lastName, email, password, orgName, orgType } = req.body || {};

  if (!firstName || !lastName || !email || !password || !orgName) {
    return res.status(400).json({ error: "firstName, lastName, email, password, and orgName are required." });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    // Generate a URL-safe slug from org name
    let slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Make sure slug is unique
    const slugExists = await prisma.organization.findUnique({ where: { slug } });
    if (slugExists) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        code: "TEMP",
        firstName,
        lastName,
        email: email.toLowerCase(),
        passwordHash,
      },
    });

    const code = userCode("owner", user.id);
    await prisma.user.update({ where: { id: user.id }, data: { code } });

    // Create organization
    const org = await prisma.organization.create({
      data: {
        name: orgName,
        slug,
        type: orgType || "residential",
        plan: "free",
      },
    });

    // Link user as owner
    await prisma.orgMember.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: "owner",
      },
    });

    await appendAuditLog(
      org.id, "CREATE_ORG", "organization", slug,
      user.email,
      `Organization created: ${orgName} by ${firstName} ${lastName}`
    );

    const token = generateToken({
      userId: user.id,
      email: user.email,
      orgId: org.id,
      role: "owner",
      code,
    });

    return res.json({
      success: true,
      token,
      user: {
        customerId: String(user.id),
        name: `${firstName} ${lastName}`.trim(),
        email: user.email,
        role: "owner",
        orgId: org.id,
        orgName: org.name,
        orgSlug: org.slug,
      },
    });
  } catch (err) {
    console.error("Error during signup:", err);
    return res.status(500).json({ error: "Failed to create account." });
  }
});

// GET /api/orgs/me — Get current org details
router.get("/orgs/me", authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          include: {
            user: { select: { id: true, code: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!org) return res.status(404).json({ error: "Organization not found." });

    return res.json({
      data: {
        orgId: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        type: org.type,
        plan: org.plan,
        createdAt: org.createdAt.toISOString(),
        members: org.members.map((m) => ({
          userId: m.user.id,
          code: m.user.code,
          name: `${m.user.firstName} ${m.user.lastName}`.trim(),
          email: m.user.email,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error("Error reading org:", err);
    return res.status(500).json({ error: "Failed to read organization." });
  }
});

// PATCH /api/orgs/me — Update org details (owner/admin only)
router.patch("/orgs/me", authenticate, authorize("owner", "admin"), async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const { name, logoUrl, type } = req.body || {};

  try {
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (logoUrl !== undefined) data.logoUrl = logoUrl;
    if (type !== undefined) data.type = type;

    const org = await prisma.organization.update({
      where: { id: orgId },
      data,
    });

    await appendAuditLog(
      orgId, "UPDATE_ORG", "organization", org.slug,
      req.user?.email || "unknown",
      `Organization updated: ${JSON.stringify(data)}`
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Error updating org:", err);
    return res.status(500).json({ error: "Failed to update organization." });
  }
});

export default router;