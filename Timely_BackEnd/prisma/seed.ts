// Dependencies (@prisma/client, bcryptjs) resolve inside the Docker container at build time.
// Run `npm install` locally only if VS Code shows import errors.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // -- 1. Create a test organization ----------------------
  const org = await prisma.organization.upsert({
    where: { slug: "timely-demo" },
    update: {},
    create: {
      name: "Timely Demo Firm",
      slug: "timely-demo",
      type: "residential",
      plan: "professional",
    },
  });

  console.log("[OK] Organization created:", org.name);

  // -- 2. Create users (no role on user anymore) ----------
  const adminPassword = await bcrypt.hash("admin123", 12);

  const fryv = await prisma.user.upsert({
    where: { email: "fryv@timely.com" },
    update: {},
    create: {
      code: "admin-1",
      firstName: "Admin",
      lastName: "Fryv",
      email: "fryv@timely.com",
      passwordHash: adminPassword,
    },
  });

  const mardij = await prisma.user.upsert({
    where: { email: "mardij@timely.com" },
    update: {},
    create: {
      code: "admin-2",
      firstName: "Admin",
      lastName: "Mardij",
      email: "mardij@timely.com",
      passwordHash: adminPassword,
    },
  });

  console.log("[OK] Admin accounts created");

  const consultantPassword = await bcrypt.hash("$CX@w9dzBh5%", 12);

  const gonzales = await prisma.user.upsert({
    where: { email: "gonzalesp@timely.com" },
    update: {},
    create: {
      code: "CO-0001",
      firstName: "Pedri",
      lastName: "Gonzales",
      email: "gonzalesp@timely.com",
      passwordHash: consultantPassword,
    },
  });

  console.log("[OK] Test consultant created");

  const clientPassword = await bcrypt.hash("L*!3MVbgwRDm", 12);

  const jackson = await prisma.user.upsert({
    where: { email: "jacksons@timely.com" },
    update: {},
    create: {
      code: "C-0001",
      firstName: "Jackson",
      lastName: "Smith",
      email: "jacksons@timely.com",
      passwordHash: clientPassword,
    },
  });

  console.log("[OK] Test client created");

  // -- 3. Link users to org with roles --------------------
  const members = [
    { userId: fryv.id, role: "owner" as const },
    { userId: mardij.id, role: "admin" as const },
    { userId: gonzales.id, role: "consultant" as const, invitedBy: fryv.id },
    { userId: jackson.id, role: "client" as const, invitedBy: fryv.id },
  ];

  for (const m of members) {
    await prisma.orgMember.upsert({
      where: {
        userId_organizationId: {
          userId: m.userId,
          organizationId: org.id,
        },
      },
      update: {},
      create: {
        userId: m.userId,
        organizationId: org.id,
        role: m.role,
        invitedBy: m.invitedBy ?? null,
      },
    });
  }

  console.log("[OK] All users linked to org with roles");
  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });