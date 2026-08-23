import { fmtDate } from "@/lib/dates";
import type { PersonFull, RecurrenceRow } from "@/lib/person-view";
import { addFreeEntry, addInterview, fillSlot, deleteEntry } from "@/lib/eval-actions";
import { RefreshCw, PenLine, Paperclip, FolderOpen, MessagesSquare } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FileDrop } from "@/components/FileDrop";
import { DateField } from "@/components/DateField";
import { EVAL_SCALE, scoreLabel } from "@/lib/eval-scale";

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
  // Two orthogonal questions, each asked where it belongs: recurringEventId
  // separates plan occurrences, then kind splits what remains. Both lists run
  // by EVENT date — a list of things that happened belongs in the order they
  // happened, not the order someone typed them up.
  const adHoc = person.evalEntries.filter((e) => e.recurringEventId == null);
  const byEventDate = <T extends { eventDate: Date }>(rows: T[]) =>
    [...rows].sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
  const freeEntries = byEventDate(adHoc.filter((e) => e.kind === "FREE"));
  const interviews = byEventDate(adHoc.filter((e) => e.kind === "INTERVIEW"));
  // Show slots that are due/past or already filled; hide far-future noise beyond the next one per event.
  const slots = [...recurrences].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const seenFutureOf = new Set<string>();
  const visibleSlots = slots.filter((s) => {
    // waived occurrences predate the assignment: shown only when something was
    // actually filed against them, never as an outstanding slot
    if (s.waived) return !!s.filledByEntryId;
    if (s.filledByEntryId || s.dueDate.getTime() <= today.getTime()) return true;
    if (!seenFutureOf.has(s.recurringEventId)) {
      seenFutureOf.add(s.recurringEventId);
      return true; // the next upcoming occurrence per event
    }
    return false;
  });

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-card shadow-sm p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-900"><FolderOpen className="h-5 w-5 text-brand-600" aria-hidden /> חוות דעת ואירועים</h2>

      {/* Structured slots from recurring plan events */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 font-medium"><RefreshCw className="h-4 w-4 text-brand-600" aria-hidden /> מובנה (מוזן מהתכנית)</h3>
        {visibleSlots.length === 0 ? (
          <p className="text-sm text-muted">אין מופעים מתוזמנים.</p>
        ) : (
          <ul className="space-y-2">
            {visibleSlots.map((s) => {
              const entry = s.filledByEntryId ? entryById.get(s.filledByEntryId) : undefined;
              const pastDue = !entry && !s.waived && s.dueDate.getTime() < today.getTime();
              return (
                <li
                  key={`${s.recurringEventId}:${s.offsetMonths}`}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    entry ? "border-emerald-200 bg-emerald-50/50" : pastDue ? "border-red-200 bg-red-50/50" : "border-border"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {entry ? "✅" : pastDue ? "🔴" : s.waived ? "⊘" : "⬜"}{" "}
                      <span className="font-medium">{s.label}</span>{" "}
                      <span className="text-muted">· יעד {fmtDate(s.dueDate)}</span>
                      {pastDue && <span className="text-red-700"> · טרם מולא</span>}
                      {s.waived && <span className="text-muted"> · פטור</span>}
                    </span>
                    {editing && entry && (
                      <ActionForm action={deleteEntry}>
                        <input type="hidden" name="personId" value={person.id} />
                        <input type="hidden" name="entryId" value={entry.id} />
                        <button className="text-xs text-red-600 hover:underline">מחק מילוי</button>
                      </ActionForm>
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
                    <ActionForm action={fillSlot} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="personId" value={person.id} />
                      <input type="hidden" name="recurringEventId" value={s.recurringEventId} />
                      <input type="hidden" name="occurrenceOffset" value={s.offsetMonths} />
                      <textarea
                        name="content"
                        rows={2}
                        placeholder="תוכן חוות הדעת…"
                        className={`${inputCls} min-w-64 flex-1`}
                      />
                      <FileDrop name="file" label="גרור/י קובץ" className="min-w-48" />
                      <button className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                        מלא מופע
                      </button>
                    </ActionForm>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Ad-hoc interview summaries — their own list: a rated interview and a
          note about a conference answer different questions, and one list would
          make both harder to scan. */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 font-medium">
          <MessagesSquare className="h-4 w-4 text-brand-600" aria-hidden /> סיכומי ראיון
        </h3>
        {interviews.length === 0 ? (
          <p className="text-sm text-muted">אין סיכומי ראיון.</p>
        ) : (
          <ul className="space-y-2">
            {interviews.map((e) => (
              <li key={e.id} className="rounded-md border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{e.title}</span>
                    {/* the label always travels with the number — a bare 3 says nothing */}
                    {e.score != null && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
                        {scoreLabel(e.score)}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted">{fmtDate(e.eventDate)}</span>
                    {editing && (
                      <ActionForm action={deleteEntry}>
                        <input type="hidden" name="personId" value={person.id} />
                        <input type="hidden" name="entryId" value={e.id} />
                        <button className="text-xs text-red-600 hover:underline">מחק</button>
                      </ActionForm>
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
          <ActionForm action={addInterview} className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3">
            <input type="hidden" name="personId" value={person.id} />
            <div className="flex flex-col">
              <label className="mb-1 text-sm text-muted">נושא</label>
              <input name="title" required placeholder="למשל: ראיון אמצע שנה" className={inputCls} />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-sm text-muted">תאריך הראיון</label>
              <DateField name="eventDate" defaultDate={today} className={inputCls + " text-end"} />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-sm text-muted">דירוג (אופציונלי)</label>
              <select name="score" defaultValue="" className={inputCls}>
                {/* an explicit empty option, so "not rated" is a choice rather than an oversight */}
                <option value="">ללא דירוג</option>
                {EVAL_SCALE.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.value} · {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-64 flex-1 flex-col">
              <label className="mb-1 text-sm text-muted">סיכום</label>
              <textarea name="content" rows={2} className={inputCls} />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-sm text-muted">קובץ (אופציונלי)</label>
              <FileDrop name="file" label="גרור/י קובץ" className="min-w-48" />
            </div>
            <button className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              הוסף סיכום ראיון
            </button>
          </ActionForm>
        )}
      </div>

      {/* Free-form entries */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 font-medium"><PenLine className="h-4 w-4 text-brand-600" aria-hidden /> חופשי</h3>
        {freeEntries.length === 0 ? (
          <p className="text-sm text-muted">אין רשומות חופשיות.</p>
        ) : (
          <ul className="space-y-2">
            {freeEntries.map((e) => (
              <li key={e.id} className="rounded-md border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{e.title}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted">{fmtDate(e.eventDate)}</span>
                    {editing && (
                      <ActionForm action={deleteEntry}>
                        <input type="hidden" name="personId" value={person.id} />
                        <input type="hidden" name="entryId" value={e.id} />
                        <button className="text-xs text-red-600 hover:underline">מחק</button>
                      </ActionForm>
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
          <ActionForm action={addFreeEntry} className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3">
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
              <label className="mb-1 text-sm text-muted">תאריך האירוע</label>
              <DateField name="eventDate" defaultDate={today} className={inputCls + " text-end"} />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-sm text-muted">קובץ (אופציונלי)</label>
              <FileDrop name="file" label="גרור/י קובץ" className="min-w-48" />
            </div>
            <button className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              הוסף רשומה
            </button>
          </ActionForm>
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
            className="rounded-md border border-border px-2 py-0.5 text-xs text-brand-700 hover:bg-slate-50"
          >
            <Paperclip className="inline h-3 w-3" aria-hidden /> {a.filename} ({Math.max(1, Math.round(a.size / 1024))}KB)
          </a>
        </li>
      ))}
    </ul>
  );
}
