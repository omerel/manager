import { fmtDate } from "@/lib/dates";
import type { PersonFull, RecurrenceRow } from "@/lib/person-view";
import { addFreeEntry, fillSlot, deleteEntry } from "@/lib/eval-actions";

const inputCls = "rounded-md border border-border px-3 py-1.5 text-sm";

export function EvaluationsSection({
  person,
  recurrences,
  editing,
  today,
}: {
  person: PersonFull;
  recurrences: RecurrenceRow[];
  editing: boolean;
  today: Date;
}) {
  const entryById = new Map(person.evalEntries.map((e) => [e.id, e]));
  const freeEntries = person.evalEntries.filter((e) => e.recurringEventId == null);
  // Show slots that are due/past or already filled; hide far-future noise beyond the next one per event.
  const slots = [...recurrences].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const seenFutureOf = new Set<string>();
  const visibleSlots = slots.filter((s) => {
    if (s.filledByEntryId || s.dueDate.getTime() <= today.getTime()) return true;
    if (!seenFutureOf.has(s.recurringEventId)) {
      seenFutureOf.add(s.recurringEventId);
      return true; // the next upcoming occurrence per event
    }
    return false;
  });

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">חוות דעת ואירועים</h2>

      {/* Structured slots from recurring plan events */}
      <div>
        <h3 className="mb-2 font-medium">🔁 מובנה (מוזן מהתכנית)</h3>
        {visibleSlots.length === 0 ? (
          <p className="text-sm text-muted">אין מופעים מתוזמנים.</p>
        ) : (
          <ul className="space-y-2">
            {visibleSlots.map((s) => {
              const entry = s.filledByEntryId ? entryById.get(s.filledByEntryId) : undefined;
              const pastDue = !entry && s.dueDate.getTime() < today.getTime();
              return (
                <li
                  key={`${s.recurringEventId}:${s.offsetMonths}`}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    entry ? "border-emerald-200 bg-emerald-50/50" : pastDue ? "border-red-200 bg-red-50/50" : "border-border"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {entry ? "✅" : pastDue ? "🔴" : "⬜"}{" "}
                      <span className="font-medium">{s.label}</span>{" "}
                      <span className="text-muted">· יעד {fmtDate(s.dueDate)}</span>
                      {pastDue && <span className="text-red-700"> · טרם מולא</span>}
                    </span>
                    {editing && entry && (
                      <form action={deleteEntry}>
                        <input type="hidden" name="personId" value={person.id} />
                        <input type="hidden" name="entryId" value={entry.id} />
                        <button className="text-xs text-red-600 hover:underline">מחק מילוי</button>
                      </form>
                    )}
                  </div>

                  {entry && (
                    <div className="mt-2 space-y-1">
                      {entry.content && <p className="whitespace-pre-wrap">{entry.content}</p>}
                      <AttachmentLinks attachments={entry.attachments} />
                      <p className="text-xs text-muted">הוזן {fmtDate(entry.createdAt)}</p>
                    </div>
                  )}

                  {editing && !entry && (
                    <form action={fillSlot} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="personId" value={person.id} />
                      <input type="hidden" name="recurringEventId" value={s.recurringEventId} />
                      <input type="hidden" name="occurrenceOffset" value={s.offsetMonths} />
                      <textarea
                        name="content"
                        rows={2}
                        placeholder="תוכן חוות הדעת…"
                        className={`${inputCls} min-w-64 flex-1`}
                      />
                      <input type="file" name="file" className="text-xs" />
                      <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                        מלא מופע
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Free-form entries */}
      <div>
        <h3 className="mb-2 font-medium">✍️ חופשי</h3>
        {freeEntries.length === 0 ? (
          <p className="text-sm text-muted">אין רשומות חופשיות.</p>
        ) : (
          <ul className="space-y-2">
            {freeEntries.map((e) => (
              <li key={e.id} className="rounded-md border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{e.title}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted">{fmtDate(e.createdAt)}</span>
                    {editing && (
                      <form action={deleteEntry}>
                        <input type="hidden" name="personId" value={person.id} />
                        <input type="hidden" name="entryId" value={e.id} />
                        <button className="text-xs text-red-600 hover:underline">מחק</button>
                      </form>
                    )}
                  </span>
                </div>
                {e.content && <p className="mt-1 whitespace-pre-wrap">{e.content}</p>}
                <AttachmentLinks attachments={e.attachments} />
              </li>
            ))}
          </ul>
        )}

        {editing && (
          <form action={addFreeEntry} className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3">
            <input type="hidden" name="personId" value={person.id} />
            <div className="flex flex-col">
              <label className="mb-1 text-sm text-muted">כותרת</label>
              <input name="title" placeholder="למשל: השתתפות בכנס" className={inputCls} />
            </div>
            <div className="flex min-w-64 flex-1 flex-col">
              <label className="mb-1 text-sm text-muted">תוכן</label>
              <textarea name="content" rows={2} className={inputCls} />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-sm text-muted">קובץ (אופציונלי)</label>
              <input type="file" name="file" className="text-xs" />
            </div>
            <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              הוסף רשומה
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function AttachmentLinks({ attachments }: { attachments: { id: string; filename: string; size: number }[] }) {
  if (attachments.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-2">
      {attachments.map((a) => (
        <li key={a.id}>
          <a
            href={`/files/${a.id}`}
            className="rounded-md border border-border px-2 py-0.5 text-xs text-blue-700 hover:bg-slate-50"
          >
            📎 {a.filename} ({Math.max(1, Math.round(a.size / 1024))}KB)
          </a>
        </li>
      ))}
    </ul>
  );
}
