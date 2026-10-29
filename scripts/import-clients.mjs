// Imports agencies, clients and their Meta ad accounts from a JSON file (default scripts/clients.json).
//   node --env-file=.env scripts/import-clients.mjs [path/to/clients.json]
// Safe to re-run: agencies/clients are matched by name, ad accounts by ID (an existing
// account is moved to the client listed here). Nothing is ever deleted.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const file = process.argv[2] ?? new URL("./clients.json", import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8"));
const prisma = new PrismaClient();

const normalizeId = (id) => {
  const digits = String(id).match(/(\d{5,})/)?.[1];
  if (!digits) throw new Error(`Invalid ad account ID: ${id}`);
  return `act_${digits}`;
};

const stats = { agencies: 0, clients: 0, accounts: 0, moved: 0 };

async function importClient(c, agencyId) {
  let client = await prisma.client.findFirst({ where: { name: c.name, agencyId } });
  if (!client) {
    client = await prisma.client.create({ data: { name: c.name, agencyId } });
    stats.clients++;
  }
  for (const a of c.accounts ?? []) {
    const metaId = normalizeId(a.id);
    const existing = await prisma.adAccount.findUnique({ where: { metaId } });
    if (!existing) {
      await prisma.adAccount.create({ data: { metaId, name: a.name ?? metaId, clientId: client.id } });
      stats.accounts++;
    } else if (existing.clientId !== client.id || (a.name && existing.name !== a.name)) {
      await prisma.adAccount.update({ where: { metaId }, data: { clientId: client.id, ...(a.name ? { name: a.name } : {}) } });
      stats.moved++;
    }
  }
}

try {
  for (const ag of data.agencies ?? []) {
    let agency = await prisma.agency.findFirst({ where: { name: ag.name } });
    if (!agency) {
      agency = await prisma.agency.create({ data: { name: ag.name } });
      stats.agencies++;
    }
    for (const c of ag.clients ?? []) await importClient(c, agency.id);
  }
  for (const c of data.clients ?? []) await importClient(c, null);
  console.log(
    `Imported: ${stats.agencies} new agencies, ${stats.clients} new clients, ${stats.accounts} new ad accounts, ${stats.moved} accounts updated.`,
  );
} finally {
  await prisma.$disconnect();
}
