"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";

export type ReviewItem = {
  proposalId: string;
  key: string;
  label: string;
  current: string;
  proposed: string;
  kind?: "delete";
};
export type ReviewPerson = {
  personId: string;
  fullName: string;
  items: ReviewItem[];
  warnings: string[];
};

/**
 * The central review: people expand to their changes, each field approved or
 * rejected on its own. Marks live client-side; every act of approval flows
 * through the SAME server action the intake proposals use — this screen is a
 * view over that path, never a second write path.
 *
 * Deletion proposals start UNMARKED: the dangerous kind asks for a deliberate
 * tick, by design.
 */
export function HrUpdateReview({
  people,
  resolve,
  conclude,
  dismiss,
}: {
  people: ReviewPerson[];
  resolve: (formData: FormData) => Promise<void>;
  conclude: () => Promise<void>;
  dismiss: () => Promise<void>;
}) {
  // item key → decision; undefined = untouched
  const [done, setDone] = useState<Map<string, "applied" | "rejected">>(new Map());
  const [marked, setMarked] = useState<Set<string>>(
    () => new Set(people.flatMap((p) => p.items.filter((i) => i.kind !== "delete").map((i) => `${p.personId}:${i.key}`))),
  );
  const [pending, startTransition] = useTransition();

  const act = (p: ReviewPerson, i: ReviewItem, decision: "apply" | "reject") => {
    const fd = new FormData();
    fd.set("personId", p.personId);
    fd.set("proposalId", i.proposalId);
    fd.set("key", i.key);
    fd.set("decision", decision);
    fd.set("stay", "1");
    startTransition(async () => {
      await resolve(fd);
      setDone((prev) => new Map(prev).set(`${p.personId}:${i.key}`, decision === "apply" ? "applied" : "rejected"));
    });
  };

  const approvePerson = (p: ReviewPerson) => {
    startTransition(async () => {
      for (const i of p.items) {
        const id = `${p.personId}:${i.key}`;
        if (done.has(id) || !marked.has(id)) continue;
        const fd = new FormData();
        fd.set("personId", p.personId);
        fd.set("proposalId", i.proposalId);
        fd.set("key", i.key);
        fd.set("decision", "apply");
        fd.set("stay", "1");
        await resolve(fd);
        setDone((prev) => new Map(prev).set(id, "applied"));
      }
    });
  };

  const approveAllMarked = () => {
    startTransition(async () => {
      for (const p of people) {
        for (const i of p.items) {
          const id = `${p.personId}:${i.key}`;
          if (done.has(id) || !marked.has(id)) continue;
          const fd = new FormData();
          fd.set("personId", p.personId);
          fd.set("proposalId", i.proposalId);
          fd.set("key", i.key);
          fd.set("decision", "apply");
          fd.set("stay", "1");
          await resolve(fd);
          setDone((prev) => new Map(prev).set(id, "applied"));
        }
      }
    });
  };

  const total = people.reduce((s, p) => s + p.items.length, 0);
  const decided = done.size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={approveAllMarked}
          disabled={pending}
          className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          אשר את כל המסומנים
        </button>
        <span className="text-sm text-muted">{decided}/{total} הוכרעו</span>
        <ActionForm action={conclude} className="ms-auto">
          <button className="rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-sm text-brand-800 hover:bg-brand-100">
            סיים סקירה ושמור להיסטוריה
          </button>
        </ActionForm>
        <ActionForm action={dismiss}>
          <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">בטל ריצה</button>
        </ActionForm>
      </div>

      {people.map((p) => (
        <details key={p.personId} open className="rounded-xl border border-border/70 bg-card shadow-sm">
          <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2 px-4 py-2.5 hover:bg-stone-50">
            <span className="font-medium">{p.fullName}</span>
            <span className="text-xs text-muted">{p.items.length} שינויים</span>
            {p.warnings.map((w, i) => (
              <span key={i} className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">⚠ {w}</span>
            ))}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); approvePerson(p); }}
              disabled={pending}
              className="ms-auto rounded-md border border-border px-2 py-1 text-xs hover:bg-slate-50"
            >
              אשר אדם
            </button>
          </summary>
          <ul className="divide-y divide-border/60 border-t border-border/70 px-4">
            {p.items.map((i) => {
              const id = `${p.personId}:${i.key}`;
              const state = done.get(id);
              return (
                <li key={i.key} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  {!state && (
                    <input
                      type="checkbox"
                      checked={marked.has(id)}
                      onChange={() =>
                        setMarked((prev) => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          return next;
                        })
                      }
                      className="accent-brand-600"
                    />
                  )}
                  <span className="w-44 font-medium">
                    {i.kind === "delete" && <Trash2 className="ms-1 inline h-3.5 w-3.5 text-red-600" aria-hidden />} {i.label}
                  </span>
                  <span className="text-muted line-through">{i.current || "—"}</span>
                  <span>←</span>
                  <span className={i.kind === "delete" ? "text-red-700" : "font-medium"}>
                    {i.kind === "delete" ? "מחיקה" : i.proposed}
                  </span>
                  {state === "applied" && <span className="flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />יושם</span>}
                  {state === "rejected" && <span className="flex items-center gap-1 text-xs text-muted"><XCircle className="h-3.5 w-3.5" aria-hidden />נדחה</span>}
                  {!state && (
                    <span className="ms-auto flex gap-2">
                      <button onClick={() => act(p, i, "apply")} disabled={pending} className="text-xs text-brand-700 hover:underline">אשר</button>
                      <button onClick={() => act(p, i, "reject")} disabled={pending} className="text-xs text-red-600 hover:underline">דחה</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </div>
  );
}
