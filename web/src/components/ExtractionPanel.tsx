import { extractFromDocument, resolveProposalItem, discardProposal, type ProposalItem } from "@/lib/extract-actions";
import { PendingButton } from "@/components/PendingButton";

/** Edit-mode: upload a document → agent proposes values → approve field-by-field. */
export function ExtractionPanel({
  personId,
  proposal,
  emptyResult,
}: {
  personId: string;
  proposal: { id: string; items: ProposalItem[] } | null;
  emptyResult: boolean;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">📄 טעינת נתונים ממסמך</h2>
      <p className="text-sm text-muted">
        העלה PDF / Word / Excel / טקסט — הסוכן ינסה להתאים ערכים לשדות הכרטיס. שום דבר לא ישתנה אוטומטית:
        כל ערך שנמצא יוצג לאישור שדה-שדה.
      </p>

      <form action={extractFromDocument} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="personId" value={personId} />
        <input
          type="file"
          name="document"
          required
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv"
          className="text-sm"
        />
        <PendingButton
          pendingLabel="הסוכן מנתח את המסמך…"
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          נתח מסמך
        </PendingButton>
        <p className="w-full text-xs text-muted">הניתוח לוקח עד דקה.</p>
      </form>

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
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-800">{it.proposed}</span>
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
