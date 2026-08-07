import Link from "next/link";
import { CheckCircle2, Loader2, XCircle, UserPlus, UserCog } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { effectiveStatus, staleError } from "@/lib/jobs";
import { startIntake, dismissIntakeRun } from "@/lib/intake-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { FileDrop } from "@/components/FileDrop";
import { AutoRefresh } from "@/components/AutoRefresh";
import { INTAKE_NEW_PERSON_LABEL, intakeUpdateLabel } from "@/lib/intake-labels";

/**
 * Bulk intake, rendered ON the people page (admin only): drop many personnel
 * documents, review each result as it becomes ready. It first shipped as a
 * separate page behind a link — and the admin dropped files on the people list
 * itself, where nothing caught them. The request was "בעמוד אנשים", literally.
 *
 * The queue is the user's recent INTAKE runs — the runs are the batch state.
 */
export async function IntakeSection({ userId }: { userId: string }) {
  const runs = await prisma.agentRun.findMany({
    where: { userId, kind: "INTAKE" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const anyLive = runs.some((r) => effectiveStatus(r) === "RUNNING");

  // draft rows may have been consumed (approved) or discarded since the run
  // finished — a link to a dead draft should say so rather than 404
  const draftIds = runs
    .map((r) => (r.output?.startsWith("draft:") ? r.output.slice(6) : null))
    .filter((v): v is string => v !== null);
  const liveDrafts = new Set(
    (await prisma.personDraft.findMany({ where: { id: { in: draftIds } }, select: { id: true } })).map((d) => d.id),
  );
  const personIds = runs
    .map((r) => (r.output?.startsWith("person:") ? r.output.slice(7) : null))
    .filter((v): v is string => v !== null);
  const personName = new Map(
    (await prisma.person.findMany({ where: { id: { in: personIds } }, select: { id: true, fullName: true } })).map(
      (p) => [p.id, p.fullName],
    ),
  );
  const openProposals = new Set(
    (await prisma.extractionProposal.findMany({ where: { personId: { in: personIds } }, select: { personId: true } })).map(
      (p) => p.personId,
    ),
  );

  /**
   * A row is listed while it still wants attention. Approving consumes the
   * artifact — createPerson deletes the draft, resolving the last field deletes
   * the proposal — so a reviewed-and-saved item drops out of the queue on its
   * own, with nothing to clean up and no second source of truth about what is
   * "done". Dismissing deletes the artifact and the run, and lands here too.
   */
  const pending = runs.filter((r) => {
    const status = effectiveStatus(r);
    if (status !== "SUCCEEDED") return true; // running, or failed and awaiting dismissal
    if (r.output?.startsWith("draft:")) return liveDrafts.has(r.output.slice(6));
    if (r.output?.startsWith("person:")) return openProposals.has(r.output.slice(7));
    return false;
  });

  return (
    <section className="space-y-3">
      {anyLive && <AutoRefresh />}
      <form action={startIntake} className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="text-sm font-medium">קליטה מרובה ממסמכים</div>
        <p className="text-xs text-muted">
          כל קובץ מייצג עובד אחד. שם שקיים במערכת יהפוך להצעת עדכון על העובד הקיים; שם חדש — לטיוטת עובד חדש. דבר
          אינו נשמר במרשם ללא אישור שלך, פריט-פריט.
        </p>
        <FileDrop
          name="documents"
          multiple
          required
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv,.png,.jpg,.jpeg"
          label="גרור/י לכאן כמה מסמכים (PDF / Word / Excel / טקסט / סרוק) — קובץ לכל עובד"
        />
        <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          התחל קליטה
        </button>
      </form>

      {pending.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card shadow-sm">
          <div className="border-b border-border px-4 py-2 text-sm text-muted">
            {anyLive ? "מסמכים בעיבוד — הדף מתעדכן לבד; אפשר לפתוח כל פריט שמוכן בלי לחכות לשאר." : "קליטות אחרונות"}
          </div>
          <ul className="divide-y divide-border">
            {pending.map((r) => {
              const status = effectiveStatus(r);
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    {status === "RUNNING" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-600" aria-hidden />}
                    {status === "SUCCEEDED" && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-hidden />}
                    {status === "FAILED" && <XCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />}
                    <span className="truncate font-medium">{r.prompt}</span>
                    {status === "FAILED" && (
                      <span className="truncate text-xs text-red-700">{staleError(r) ?? r.error}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <ResultLink output={r.output} status={status} personName={personName} />
                    {status !== "RUNNING" && (
                      <form action={dismissIntakeRun}>
                        <input type="hidden" name="runId" value={r.id} />
                        <SubmitButton
                          className="rounded-md border border-border px-3 py-1 text-xs hover:bg-stone-50 disabled:opacity-50"
                          pendingText="מבטל…"
                        >
                          ביטול
                        </SubmitButton>
                      </form>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function ResultLink({
  output,
  status,
  personName,
}: {
  output: string | null;
  status: "RUNNING" | "SUCCEEDED" | "FAILED";
  personName: Map<string, string>;
}) {
  if (status === "RUNNING") return <span className="text-xs text-muted">מעבד…</span>;
  // failed: nothing to approve — only the dismiss button beside this
  if (status !== "SUCCEEDED" || !output) return null;

  if (output.startsWith("draft:")) {
    return (
      <Link
        href={`/people/new?draft=${output.slice(6)}`}
        className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
      >
        <UserPlus className="h-3.5 w-3.5" aria-hidden />
        {INTAKE_NEW_PERSON_LABEL}
      </Link>
    );
  }
  if (output.startsWith("person:")) {
    const id = output.slice(7);
    const name = personName.get(id);
    if (!name) return <span className="text-xs text-muted">העובד כבר אינו במערכת</span>;
    return (
      <Link
        href={`/people/${id}`}
        className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
      >
        <UserCog className="h-3.5 w-3.5" aria-hidden />
        {intakeUpdateLabel(name)}
      </Link>
    );
  }
  return null;
}
