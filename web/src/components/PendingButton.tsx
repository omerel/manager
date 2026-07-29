"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that shows a spinner + progress label while its form's server
 * action is running (long agent runs would otherwise look frozen).
 */
export function PendingButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${className ?? ""} disabled:opacity-70`}>
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
