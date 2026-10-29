"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, requireUser } from "@/lib/auth/user";
import { prisma } from "@/lib/db";
import { META_CACHE_TAG } from "@/lib/meta";

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function refreshMetaData() {
  await requireUser();
  revalidateTag(META_CACHE_TAG);
  revalidatePath("/", "layout");
}

const savedViewSchema = z.object({
  name: z.string().trim().min(1).max(60),
  href: z.string().trim().startsWith("/").max(500),
});

export async function createSavedView(input: { name: string; href: string }) {
  const user = await requireUser();
  const data = savedViewSchema.parse(input);
  const count = await prisma.savedView.count({ where: { userId: user.id } });
  if (count >= 20) return;
  await prisma.savedView.create({ data: { ...data, userId: user.id } });
  revalidatePath("/", "layout");
}

export async function deleteSavedView(id: string) {
  const user = await requireUser();
  await prisma.savedView.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/", "layout");
}
