"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/user";
import { prisma } from "@/lib/db";
import { errorMessage, isMockMode, meta, normalizeAccountId } from "@/lib/meta";
import { liveProvider } from "@/lib/meta/live";

export type FormState = { ok?: string; error?: string; nonce?: number };

const done = (ok: string): FormState => {
  revalidatePath("/", "layout");
  return { ok, nonce: Date.now() };
};
const fail = (error: string): FormState => ({ error, nonce: Date.now() });

function friendly(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "That email or ad account is already in use.";
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? "Invalid input.";
  return errorMessage(e);
}

async function guard(fn: () => Promise<FormState>): Promise<FormState> {
  await requireAdmin();
  try {
    return await fn();
  } catch (e) {
    return fail(friendly(e));
  }
}

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? v : null));

const password = z.string().min(8, "Password must be at least 8 characters.").max(200);

const userFields = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  role: z.nativeEnum(Role),
  agencyId: optionalId,
  clientId: optionalId,
});

function checkAssignment(u: { role: Role; agencyId: string | null; clientId: string | null }) {
  if (u.role === "CLIENT" && !u.clientId) throw new Error("Client users must be assigned to a client.");
  if (u.role === "AGENCY_OWNER" && !u.agencyId && !u.clientId) throw new Error("Agency owners need an agency (or a client).");
  if (u.role === "ADMIN") return { agencyId: null, clientId: null };
  if (u.role === "CLIENT") return { agencyId: null, clientId: u.clientId };
  return { agencyId: u.agencyId, clientId: u.agencyId ? null : u.clientId };
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function createUser(_: FormState, fd: FormData) {
  return guard(async () => {
    const data = userFields.extend({ password }).parse(Object.fromEntries(fd));
    const assignment = checkAssignment(data);
    await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        role: data.role,
        ...assignment,
        passwordHash: await bcrypt.hash(data.password, 12),
      },
    });
    return done(`Created ${data.email}. Share the password with them securely.`);
  });
}

export async function updateUser(_: FormState, fd: FormData) {
  return guard(async () => {
    const admin = await requireAdmin();
    const id = z.string().parse(fd.get("id"));
    const data = userFields.extend({ isActive: z.string().optional() }).parse(Object.fromEntries(fd));
    const isActive = data.isActive === "on";
    if (id === admin.id && (data.role !== "ADMIN" || !isActive)) return fail("You can't demote or deactivate your own account.");
    const assignment = checkAssignment(data);
    await prisma.user.update({ where: { id }, data: { name: data.name, email: data.email, role: data.role, isActive, ...assignment } });
    return done("User updated.");
  });
}

export async function resetPassword(_: FormState, fd: FormData) {
  return guard(async () => {
    const id = z.string().parse(fd.get("id"));
    const pw = password.parse(fd.get("password"));
    await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(pw, 12) } });
    return done("Password reset. Existing sessions stay signed in until they expire.");
  });
}

export async function deleteUser(_: FormState, fd: FormData) {
  return guard(async () => {
    const admin = await requireAdmin();
    const id = z.string().parse(fd.get("id"));
    if (id === admin.id) return fail("You can't delete your own account.");
    await prisma.user.delete({ where: { id } });
    return done("User deleted.");
  });
}

// ─── Agencies ───────────────────────────────────────────────────────────────

const name = z.string().trim().min(1, "Name is required.").max(100);

export async function createAgency(_: FormState, fd: FormData) {
  return guard(async () => {
    await prisma.agency.create({ data: { name: name.parse(fd.get("name")) } });
    return done("Agency created.");
  });
}

export async function renameAgency(_: FormState, fd: FormData) {
  return guard(async () => {
    await prisma.agency.update({ where: { id: z.string().parse(fd.get("id")) }, data: { name: name.parse(fd.get("name")) } });
    return done("Agency renamed.");
  });
}

export async function deleteAgency(_: FormState, fd: FormData) {
  return guard(async () => {
    const id = z.string().parse(fd.get("id"));
    const owners = await prisma.user.count({ where: { agencyId: id } });
    if (owners) return fail("Reassign or delete this agency's owners first.");
    await prisma.agency.delete({ where: { id } });
    return done("Agency deleted. Its clients were kept.");
  });
}

// ─── Clients ────────────────────────────────────────────────────────────────

export async function createClient(_: FormState, fd: FormData) {
  return guard(async () => {
    const data = z.object({ name, agencyId: optionalId }).parse(Object.fromEntries(fd));
    await prisma.client.create({ data });
    return done(`Client “${data.name}” created.`);
  });
}

export async function updateClient(_: FormState, fd: FormData) {
  return guard(async () => {
    const data = z.object({ id: z.string(), name, agencyId: optionalId }).parse(Object.fromEntries(fd));
    await prisma.client.update({ where: { id: data.id }, data: { name: data.name, agencyId: data.agencyId } });
    return done("Client updated.");
  });
}

export async function deleteClient(_: FormState, fd: FormData) {
  return guard(async () => {
    const id = z.string().parse(fd.get("id"));
    const users = await prisma.user.count({ where: { clientId: id, role: "CLIENT" } });
    if (users) return fail("Reassign or delete this client's users first.");
    await prisma.client.delete({ where: { id } });
    return done("Client and its ad account links deleted.");
  });
}

// ─── Ad accounts ────────────────────────────────────────────────────────────

export async function addAdAccounts(_: FormState, fd: FormData) {
  return guard(async () => {
    const clientId = z.string().min(1, "Pick a client.").parse(fd.get("clientId"));
    const manual = String(fd.get("metaId") ?? "").trim();
    const picked = fd.getAll("pick").map(String);
    const label = String(fd.get("name") ?? "").trim();

    const ids = [...new Set([...picked, ...manual.split(/[\s,]+/).filter(Boolean)].map(normalizeAccountId))];
    if (ids.some((i) => !i)) return fail("Ad account IDs look like act_1234567890 or just the number.");
    if (!ids.length) return fail("Enter an ad account ID or pick one from the list.");

    const accessible = isMockMode() ? [] : (await meta.accessibleAccounts().catch(() => ({ data: [] }))).data;
    let added = 0;
    for (const metaId of ids as string[]) {
      let accountName = accessible.find((a) => a.id === metaId)?.name;
      if (!accountName && !isMockMode()) {
        // Validates that the token can actually read this account.
        try {
          accountName = (await liveProvider.account(metaId)).name;
        } catch (e) {
          return fail(`${metaId}: ${errorMessage(e)}${added ? ` (${added} added before this)` : ""}`);
        }
      }
      const finalName = ids.length === 1 && label ? label : (accountName ?? `Ad account ${metaId.slice(-4)}`);
      await prisma.adAccount.upsert({ where: { metaId }, create: { metaId, name: finalName, clientId }, update: { clientId } });
      added++;
    }
    return done(`${added} ad account${added === 1 ? "" : "s"} linked.`);
  });
}

export async function updateAdAccount(_: FormState, fd: FormData) {
  return guard(async () => {
    const data = z.object({ id: z.string(), name, clientId: z.string().min(1) }).parse(Object.fromEntries(fd));
    await prisma.adAccount.update({ where: { id: data.id }, data: { name: data.name, clientId: data.clientId } });
    return done("Ad account updated.");
  });
}

export async function removeAdAccount(_: FormState, fd: FormData) {
  return guard(async () => {
    await prisma.adAccount.delete({ where: { id: z.string().parse(fd.get("id")) } });
    return done("Ad account unlinked. Nothing was changed in Meta.");
  });
}
