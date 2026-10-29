"use client";

import { useActionState, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { FormState } from "@/app/(app)/admin/actions";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

/** A form bound to a server action that shows its result and optionally resets on success. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
  onSuccess,
  showSuccess = true,
}: {
  action: Action;
  children: React.ReactNode | ((pending: boolean) => React.ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  onSuccess?: () => void;
  showSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  const handled = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (state.ok && state.nonce !== handled.current) {
      handled.current = state.nonce;
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
  }, [state, resetOnSuccess, onSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {typeof children === "function" ? children(pending) : children}
      {(state.error || (showSuccess && state.ok)) && (
        <p role="status" className={cn("mt-3 rounded-lg px-3 py-2 text-[13px]", state.error ? "bg-bad-soft text-bad" : "bg-good-soft text-good")}>
          {state.error ?? state.ok}
        </p>
      )}
    </form>
  );
}
