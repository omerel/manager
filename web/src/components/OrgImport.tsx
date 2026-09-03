"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { FileDrop } from "@/components/FileDrop";
import { applyOrgImport, reviewOrgImport, uploadOrgFile, type OrgImportState } from "@/lib/org-actions";
import { MEANING_LABEL, planAsTree, type OrgPreviewNode } from "@/lib/org-import";
import { KIND_LABEL } from "@/lib/org-nesting";

/**
 * Building the whole tree from a file, in three deliberate steps.
 *
 * Upload proposes a column mapping; the Admin corrects and approves it; only
 * then are the rows validated — by the columns they chose. The last step states
 * what replacing the tree costs, in counts, before anything is written.
 */
export function OrgImport() {
  const [state, act, pending] = useActionState<OrgImportState, FormData>(step, { step: "idle" });

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <FileSpreadsheet className="h-5 w-5 text-brand-600" aria-hidden />
        ייבוא עץ מקובץ
      </h2>
      <p className="text-sm text-muted">
        קובץ Excel או CSV שבו כל שורה היא מסגרת: <b>שם המסגרת</b>, <b>סוג המסגרת</b> (מרכז / תחום / מדור / צוות)
        ו<b>מסגרת אב</b>. שמות העמודות אינם חייבים להיות מדויקים — המערכת תציע התאמה, ותוכל לתקן אותה לפני הבדיקה.
      </p>

      {state.step === "error" && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{state.error}</p>
      )}

      {state.step === "done" && (
        <p className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          העץ יובא בהצלחה — {state.created} מסגרות.
        </p>
      )}

      {(state.step === "idle" || state.step === "error" || state.step === "done") && (
        <form action={act} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="stage" value="upload" />
          <FileDrop name="file" required label="גרור/י קובץ Excel או CSV" className="min-w-72" />
          <button
            disabled={pending}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Upload className="h-4 w-4" aria-hidden />
            {pending ? "קורא…" : "העלה וקרא"}
          </button>
        </form>
      )}

      {state.step === "map" && <MapStep state={state} act={act} pending={pending} />}
      {state.step === "review" && <ReviewStep state={state} act={act} pending={pending} />}
    </section>
  );
}

/** The action the form posts to; the stage field says which step to run. */
async function step(prev: OrgImportState, formData: FormData): Promise<OrgImportState> {
  const stage = String(formData.get("stage") ?? "upload");
  if (stage === "review") return reviewOrgImport(prev, formData);
  if (stage === "apply") return applyOrgImport(prev, formData);
  return uploadOrgFile(prev, formData);
}

const TARGETS: { value: string; label: string }[] = [
  { value: "ignore", label: "— התעלם —" },
  { value: "name", label: MEANING_LABEL.name },
  { value: "kind", label: MEANING_LABEL.kind },
  { value: "parent", label: MEANING_LABEL.parent },
];

function MapStep({
  state, act, pending,
}: { state: Extract<OrgImportState, { step: "map" }>; act: (fd: FormData) => void; pending: boolean }) {
  return (
    <form action={act} className="space-y-3">
      <input type="hidden" name="stage" value="review" />
      <input
        type="hidden"
        name="payload"
        value={JSON.stringify({ headers: state.headers, rows: state.rows, filename: state.filename })}
      />
      <p className="text-sm text-muted">
        <b>{state.filename}</b> · {state.rows.length} שורות. התאמת העמודות — עמודה שאינה מותאמת פשוט לא תיקרא:
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {state.mapping.map((c, i) => (
          <label key={c.header + i} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <span className="truncate" title={c.header}>{c.header || `עמודה ${i + 1}`}</span>
            <select
              name={`col_${i}`}
              defaultValue={c.target}
              className="rounded-md border border-border px-2 py-1 text-xs"
              aria-label={`התאמה לעמודה ${c.header}`}
            >
              {TARGETS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button
        disabled={pending}
        className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "בודק…" : "אשר התאמה ובדוק את הקובץ"}
      </button>
    </form>
  );
}

function ReviewStep({
  state, act, pending,
}: { state: Extract<OrgImportState, { step: "review" }>; act: (fd: FormData) => void; pending: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const clean = state.faults.length === 0;
  const empty = state.cost.frameworks === 0;

  return (
    <div className="space-y-4">
      {!clean ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-red-800">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            נמצאו {state.faults.length} שגיאות. תקן/י את הקובץ והעלה/י אותו שוב — לא ניתן לתקן כאן.
          </p>
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {state.faults.map((f, i) => (
              <li key={i}>
                {f.row ? <b>שורה {f.row}</b> : <b>הקובץ</b>}
                {f.name ? ` · ${f.name}` : ""} — {f.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">
            הקובץ תקין: <b>{state.plan.length}</b> מסגרות. כך ייראה העץ:
          </p>
          <div className="max-h-72 overflow-auto rounded-md border border-border bg-stone-50/50 p-3 text-sm">
            {planAsTree(state.plan).map((n) => (
              <PreviewNode key={n.name} node={n} depth={0} />
            ))}
          </div>

          {confirming ? (
            <form action={act} className="space-y-3 rounded-md border border-red-300 bg-red-50 px-4 py-3">
              <input type="hidden" name="stage" value="apply" />
              <input
                type="hidden"
                name="payload"
                value={JSON.stringify({ headers: state.mapping.map((c) => c.header), rows: state.rows, mapping: state.mapping })}
              />
              <p className="flex items-center gap-2 text-sm font-medium text-red-900">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                {empty ? "אין עץ קיים — הייבוא פשוט ייווצר." : "הייבוא מחליף את העץ הקיים לחלוטין. יימחקו:"}
              </p>
              {!empty && (
                <ul className="space-y-0.5 text-sm text-red-900">
                  <li>· {state.cost.frameworks} מסגרות</li>
                  <li>· {state.cost.grants} הרשאות — כל מפקד יאבד את הראות שלו עד שתינתן מחדש</li>
                  <li>· {state.cost.queries} שאילתות, על יעדיהן ותשובותיהן</li>
                  <li>· {state.cost.commanders} מינויי פיקוד</li>
                  <li>
                    · {state.cost.peopleUnassigned} אנשים יישארו ללא מסגרת — הכרטיסים, התכניות וההיסטוריה שלהם נשמרים
                  </li>
                </ul>
              )}
              <div className="flex gap-2">
                <button
                  disabled={pending}
                  className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {pending ? "מייבא…" : empty ? "צור את העץ" : "אשר החלפה"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-white"
                >
                  ביטול
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              {empty ? "צור את העץ" : "החלף את העץ הקיים…"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function PreviewNode({ node, depth }: { node: OrgPreviewNode; depth: number }) {
  return (
    <div>
      <div style={{ paddingInlineStart: `${depth * 18}px` }} className="py-0.5">
        <span className="text-xs text-muted">{KIND_LABEL[node.kind]}</span> <span className="font-medium">{node.name}</span>
      </div>
      {node.children.map((c) => (
        <PreviewNode key={c.name} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}
