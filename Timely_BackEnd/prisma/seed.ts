import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const adminPassword = await bcrypt.hash("admin123", 12);

  await prisma.user.upsert({
    where: { email: "fryv@timely.com" },
    update: {},
    create: {
      code: "admin-1",
      firstName: "Admin",
      lastName: "Fryv",
      email: "fryv@timely.com",
      passwordHash: adminPassword,
      role: "admin",
    },
  });

  await prisma.user.upsert({
    where: { email: "mardij@timely.com" },
    update: {},
    create: {
      code: "admin-2",
      firstName: "Admin",
      lastName: "Mardij",
      email: "mardij@timely.com",
      passwordHash: adminPassword,
      role: "admin",
    },
  });

  console.log("✅ Admin accounts created");

  const consultantPassword = await bcrypt.hash("$CX@w9dzBh5%", 12);

  await prisma.user.upsert({
    where: { email: "gonzalesp@timely.com" },
    update: {},
    create: {
      code: "CO-0001",
      firstName: "Pedri",
      lastName: "Gonzales",
      email: "gonzalesp@timely.com",
      passwordHash: consultantPassword,
      role: "consultant",
    },
  });

  console.log("✅ Test consultant created");

  const clientPassword = await bcrypt.hash("L*!3MVbgwRDm", 12);

  await prisma.user.upsert({
    where: { email: "jacksons@timely.com" },
    update: {},
    create: {
      code: "C-0001",
      firstName: "Jackson",
      lastName: "Smith",
      email: "jacksons@timely.com",
      passwordHash: clientPassword,
      role: "client",
    },
  });

  console.log("✅ Test client created");
  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });