import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/overview");
  const { next } = await searchParams;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <div className="text-[26px] font-semibold tracking-tight text-ink">Blendfold Media</div>
          <div className="mt-1 text-sm text-muted">Media portfolio</div>
        </div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Use the email and password your Blendfold admin gave you.</p>
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-center text-xs text-muted">Forgot your password? Ask your Blendfold admin to reset it.</p>
      </div>
    </div>
  );
}
