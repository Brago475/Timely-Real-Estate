import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/database.js";

const JWT_SECRET = process.env.JWT_SECRET || "timely-dev-secret-change-in-production";

export interface AuthPayload {
  userId: number;
  email: string;
  orgId: number;
  role: string;
  code: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided." });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Not authorized." });
      return;
    }

    next();
  };
}

// Helper: look up a user's membership in a specific org
export async function getOrgMembership(userId: number, orgId: number) {
  return prisma.orgMember.findUnique({
    where: {
      userId_organizationId: { userId, organizationId: orgId },
    },
    include: { organization: true },
  });
}