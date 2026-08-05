"use client";

/**
 * A submit button that asks before it acts.
 *
 * Exists because the alternative in use was worse: the action threw an error
 * demanding a tick-box, which rendered as an error page. Refusing an action to
 * ask a question makes an ordinary decision look like a fault — a confirmation
 * belongs in front of the action, not inside it.
 *
 * `confirm()` is native and synchronous, which is exactly what is wanted here:
 * no dialog state to manage, and the form genuinely does not submit when the
 * answer is no. ConfirmDelete exists for the heavier, detailed cases; this is
 * the one-sentence variety.
 */
export function ConfirmSubmit({
  action,
  queryId,
  label,
  confirm: message,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  queryId: string;
  label: string;
  confirm: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className="pb-0.5"
    >
      <input type="hidden" name="queryId" value={queryId} />
      <button className={className ?? "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50"}>
        {label}
      </button>
    </form>
  );
}
