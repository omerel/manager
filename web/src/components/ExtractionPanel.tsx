import { extractFromDocument, resolveProposalItem, discardProposal, type ProposalItem } from "@/lib/extract-actions";
import { PendingButton } from "@/components/PendingButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { FileDrop } from "@/components/FileDrop";
import { FileScan } from "lucide-react";

export type ExtractionJobView = { status: "RUNNING" | "SUCCEEDED" | "FAILED"; error: string | null } | null;

/** Edit-mode: upload a document → agent proposes values (in the background) → approve field-by-field. */
export function ExtractionPanel({
  personId,
  proposal,
  emptyResult,
  job,
  busy,
}: {
  personId: string;
  proposal: { id: string; items: ProposalItem[] } | null;
  emptyResult: boolean;
  job: ExtractionJobView;
  busy: boolean;
}) {
  const running = job?.status === "RUNNING";
  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-card shadow-sm p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-900"><FileScan className="h-5 w-5 text-brand-600" aria-hidden /> טעינת נתונים ממסמך</h2>
      <p className="text-sm text-muted">
        העלה PDF / Word / Excel / טקסט — הסוכן ינסה להתאים ערכים לשדות הכרטיס. שום דבר לא ישתנה אוטומטית:
        כל ערך שנמצא יוצג לאישור שדה-שדה.
      </p>

      {running ? (
        <div className="flex items-center gap-3 rounded-md border border-brand-200 bg-brand-50/60 px-4 py-3 text-sm text-brand-800">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
          הסוכן מנתח את המסמך… ההצעות יופיעו כאן אוטומטית.
          <AutoRefresh />
        </div>
      ) : (
        <form action={extractFromDocument} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="personId" value={personId} />
          <FileDrop
            name="document"
            required
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv,.png,.jpg,.jpeg"
            label="גרור/י מסמך לכאן (PDF / Word / Excel / טקסט / סרוק)"
            className="min-w-72 flex-1"
          />
          <PendingButton
            pendingLabel="מתחיל ניתוח…"
            className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            נתח מסמך
          </PendingButton>
          <p className="w-full text-xs text-muted">הניתוח רץ ברקע — אפשר להמשיך לעבוד.</p>
        </form>
      )}

      {busy && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          כבר רץ ניתוח עבור עובד/ת זה/זו — המתן לסיומו.
        </div>
      )}
      {job?.status === "FAILED" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          הניתוח נכשל: {job.error}
        </div>
      )}
      {emptyResult && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          הסוכן לא מצא במסמך ערכים חדשים המתאימים לשדות הכרטיס.
        </div>
      )}

      {proposal && proposal.items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">הצעות מהמסמך — ממתינות לאישור</h3>
            <form action={discardProposal}>
              <input type="hidden" name="personId" value={personId} />
              <button className="text-xs text-red-600 hover:underline">דחה הכל</button>
            </form>
          </div>
          <ul className="divide-y divide-border rounded-md border border-border">
            {proposal.items.map((it) => (
              <li key={it.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{it.label}:</span>
                  <span className="text-muted line-through">{it.current || "—"}</span>
                  <span>←</span>
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-800">{it.proposed}</span>
                </span>
                <span className="flex items-center gap-2">
                  <form action={resolveProposalItem}>
                    <input type="hidden" name="personId" value={personId} />
                    <input type="hidden" name="proposalId" value={proposal.id} />
                    <input type="hidden" name="key" value={it.key} />
                    <input type="hidden" name="decision" value="apply" />
                    <button className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700">אשר</button>
                  </form>
                  <form action={resolveProposalItem}>
                    <input type="hidden" name="personId" value={personId} />
                    <input type="hidden" name="proposalId" value={proposal.id} />
                    <input type="hidden" name="key" value={it.key} />
                    <input type="hidden" name="decision" value="reject" />
                    <button className="rounded border border-border px-2 py-1 text-xs hover:bg-slate-50">דחה</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
