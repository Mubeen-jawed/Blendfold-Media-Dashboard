// Seeds demo agencies, clients, ad accounts and users for local development with META_MOCK=true.
//   node --env-file=.env scripts/seed-demo.mjs
// Demo logins (password "demo-password"): owner@demo.test (agency owner), client@demo.test (client).
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO = [
  {
    agency: "Northstar Group",
    clients: [
      { name: "Northstar", accounts: [["act_100000004821", "Northstar · US"], ["act_100000004822", "Northstar · EU"]] },
      { name: "Forma Living", accounts: [["act_100000007630", "Forma Living"]] },
    ],
  },
  {
    agency: null,
    clients: [
      { name: "Sunday Supply", accounts: [["act_100000002194", "Sunday Supply"]] },
      { name: "Fieldwork Goods", accounts: [["act_100000006057", "Fieldwork Goods"]] },
      { name: "Aster Wellness", accounts: [["act_100000008306", "Aster Wellness"]] },
    ],
  },
];

try {
  let firstAgencyId = null;
  let firstClientId = null;
  for (const group of DEMO) {
    const agency = group.agency
      ? ((await prisma.agency.findFirst({ where: { name: group.agency } })) ?? (await prisma.agency.create({ data: { name: group.agency } })))
      : null;
    firstAgencyId ??= agency?.id ?? null;
    for (const c of group.clients) {
      const client =
        (await prisma.client.findFirst({ where: { name: c.name } })) ??
        (await prisma.client.create({ data: { name: c.name, agencyId: agency?.id ?? null } }));
      firstClientId ??= client.id;
      for (const [metaId, name] of c.accounts) {
        await prisma.adAccount.upsert({ where: { metaId }, create: { metaId, name, clientId: client.id }, update: {} });
      }
    }
  }

  const passwordHash = await bcrypt.hash("demo-password", 12);
  await prisma.user.upsert({
    where: { email: "owner@demo.test" },
    create: { email: "owner@demo.test", name: "Olivia Owner", passwordHash, role: "AGENCY_OWNER", agencyId: firstAgencyId },
    update: {},
  });
  await prisma.user.upsert({
    where: { email: "client@demo.test" },
    create: { email: "client@demo.test", name: "Casey Client", passwordHash, role: "CLIENT", clientId: firstClientId },
    update: {},
  });
  console.log("Demo data seeded. Logins: owner@demo.test / client@demo.test (password: demo-password)");
} finally {
  await prisma.$disconnect();
}
