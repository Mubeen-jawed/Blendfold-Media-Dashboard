// Creates (or with --reset, re-passwords) an admin user.
//   node --env-file=.env scripts/create-admin.mjs [email] [password] [name] [--reset]
// Falls back to ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME from the environment.
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const reset = process.argv.includes("--reset");
const email = (args[0] ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = args[1] ?? process.env.ADMIN_PASSWORD ?? "";
const name = args[2] ?? process.env.ADMIN_NAME ?? "Admin";

if (!email || !password) {
  console.error("Usage: create-admin.mjs <email> <password> [name] [--reset]  (or set ADMIN_EMAIL / ADMIN_PASSWORD)");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !reset) {
    console.log(`User ${email} already exists — left unchanged (pass --reset to set a new password).`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { email },
      create: { email, name, passwordHash, role: "ADMIN" },
      update: { passwordHash, role: "ADMIN", isActive: true, agencyId: null, clientId: null },
    });
    console.log(`${existing ? "Updated" : "Created"} admin ${email}.`);
  }
} finally {
  await prisma.$disconnect();
}
