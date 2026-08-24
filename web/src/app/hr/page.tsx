import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, FileSpreadsheet, AlertTriangle, Bot } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ActionForm } from "@/components/ActionForm";
import { PendingButton } from "@/components/PendingButton";
import {
  uploadImport,
  remapImport,
  approveImport,
  dismissImport,
  currentImport,
} from "@/lib/hr-import-actions";
import {
  uploadUpdateFile,
  acceptStructureChange,
  approveUpdateMapping,
  concludeUpdateRun,
  dismissUpdateRun,
  getUpdateRun,
} from "@/lib/hr-update-actions";
import { careerTargetSources } from "@/lib/hr-update";
import { TargetPicker, type TargetOption } from "@/components/TargetPicker";
import { readMovements } from "@/lib/movements";
import { DateField } from "@/components/DateField";
import { computeVisibility } from "@/lib/access";
import { parseIsraeliDate, formatIsraeliDate } from "@/lib/dates";
import type { MovementKind } from "@/generated/prisma/client";
import { resolveProposalItem } from "@/lib/extract-actions";
import { HrUpdateReview, type ReviewPerson } from "@/components/HrUpdateReview";

const inputCls = "rounded-md border border-border px-3 py-1.5 text-sm";

/** The column targets the mapping editor offers, in display order. */
async function targetOptions() {
  const defs = await prisma.personFieldDef.findMany({ orderBy: { order: "asc" }, select: { id: true, label: true } });
  return [
    { value: "ignore", label: "— התעלם —" },
    { value: "firstName", label: "שם פרטי" },
    { value: "lastName", label: "שם משפחה" },
    { value: "fullName", label: "שם מלא" },
    { value: "birthDate", label: "תאריך לידה" },
    { value: "recruitmentDate", label: "תאריך גיוס" },
    { value: "placementDate", label: "תאריך הצבה" },
    { value: "endOfServiceDate", label: "תאריך סיום שירות" },
    { value: "framework", label: "מסגרת" },
    ...defs.map((d) => ({ value: `custom:${d.id}`, label: d.label })),
  ];
}

const KIND_STYLE: Record<string, { label: string; cls: string }> = {
  create: { label: "ייווצר", cls: "bg-green-100 text-green-800" },
  skip: { label: "ידולג", cls: "bg-slate-100 text-slate-600" },
  error: { label: "שגיאה", cls: "bg-red-100 text-red-800" },
  "duplicate-halt": { label: "ייתכן כפיל", cls: "bg-amber-100 text-amber-900" },
};

const MOVEMENT_META: Record<MovementKind, { label: string; cls: string }> = {
  CREATED: { label: "נוצר", cls: "bg-green-100 text-green-800" },
  MOVED: { label: "עבר", cls: "bg-blue-100 text-blue-800" },
  REMOVED: { label: "נמחק", cls: "bg-red-100 text-red-800" },
  DEPARTED: { label: "עזב", cls: "bg-slate-200 text-slate-700" },
};
const SOURCE_LABEL: Record<string, string> = {
  manual: "ידני", intake: "קליטת מסמך", import: "ייבוא טבלה", "org-delete": "מחיקת מסגרת", status: "עדכון סטטוס",
};

export default async function HrPage({ searchParams }: { searchParams: Promise<{ day?: string; mkind?: string; mteam?: string; mactor?: string }> }) {
  const { day: rawDay, mkind, mteam, mactor } = await searchParams;
  const session = await getSessionUser();
  const me = await prisma.user.findUnique({ where: { id: session.id }, select: { id: true, role: true } });
  // HR by role, Admin by their authority over everything; nobody else
  if (me?.role !== "HR" && me?.role !== "ADMIN") notFound();

  const day = parseIsraeliDate(rawDay ?? "") ?? new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  const kindFilter = ["CREATED", "MOVED", "REMOVED", "DEPARTED"].includes(mkind ?? "") ? (mkind as MovementKind) : undefined;
  const visibility = await computeVisibility(session);
  const [current, targets, updateRun, career, snapshots] = await Promise.all([
    currentImport(me.id),
    targetOptions(),
    getUpdateRun(me.id),
    careerTargetSources(),
    prisma.importSnapshot.findMany({ orderBy: { uploadedAt: "desc" }, take: 5 }),
  ]);
  const movements = await readMovements(visibility, day, {
    kind: kindFilter,
    teamId: mteam || undefined,
    actorId: mactor || undefined,
  });
  const movementActors = [...new Map(movements.map((m) => [m.actorId, m.actorName])).entries()];
  const prevDay = formatIsraeliDate(new Date(day.getTime() - 86400_000));
  const nextDay = formatIsraeliDate(new Date(day.getTime() + 86400_000));
  const scopeTeams = (await prisma.orgNode.findMany({ where: { kind: "TEAM" }, orderBy: { name: "asc" } }))
    .filter((t) => visibility.canEdit(t.id));
  const state = current?.state ?? null;
  const upd = updateRun?.state ?? null;
  // every target names its SOURCE — the card, or the plans that carry the label
  const updateTargets: TargetOption[] = [
    ...targets.filter((t) => t.value !== "ignore").map((t) => ({ ...t, source: "כרטיס עובד" })),
    ...career.points.map((p) => ({ value: `point:${p.label}`, label: `אירוע: ${p.label}`, source: `מסלול קריירה: ${p.templates.join(", ")}` })),
    ...career.metrics.map((m) => ({ value: `metric:${m.name}`, label: `מדד: ${m.name}`, source: `מסלול קריירה: ${m.templates.join(", ")}` })),
  ];
  const reviewPeople: ReviewPerson[] =
    upd?.stage === "review" && upd.plan
      ? upd.plan.people
          .filter((p) => p.items.length > 0 || p.warnings.length > 0)
          .map((p) => ({
            personId: p.personId,
            fullName: p.fullName,
            warnings: p.warnings,
            items: p.items.map((i) => ({
              proposalId: "", // resolved server-side by (personId,key) — filled below
              ...i,
            })),
          }))
      : [];
  // attach the proposal ids the run created
  if (reviewPeople.length > 0) {
    const proposals = await prisma.extractionProposal.findMany({
      where: { createdBy: `hr-update:${me.id}` },
      select: { id: true, personId: true },
    });
    const byPerson = new Map(proposals.map((p) => [p.personId, p.id]));
    for (const p of reviewPeople) for (const i of p.items) i.proposalId = byPerson.get(p.personId) ?? "";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">עמוד משא״ן</h1>

      <div>
        <h2 className="text-xl font-bold">ייבוא טבלת אנשים</h2>
        <p className="mt-1 text-sm text-muted">
          קובץ CSV או Excel, שורה לאדם — יצירת אנשים חדשים. שום דבר לא נכתב לפני האישור שלך.
        </p>
      </div>

      {!state && (
        <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            העלאת קובץ
          </h2>
          <ActionForm action={uploadImport} className="flex flex-wrap items-center gap-3">
            <input type="file" name="file" accept=".csv,.xlsx,.xls" required className="text-sm" />
            <PendingButton
              pendingLabel="קורא את הקובץ… (כותרות או תאריכים בפורמט זר נשלחים לסוכן — עד דקה)"
              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              קרא ובנה תצוגה מקדימה
            </PendingButton>
          </ActionForm>
          <p className="mt-2 text-xs text-muted">
            עמודות מזוהות ממופות אוטומטית; כותרות זרות יקבלו פרשנות מהסוכן — ותוכל לתקן אותה לפני שדבר קורה. ההתאמה לפי
            תעודת זהות ואז מספר אישי.
          </p>
        </section>
      )}

      {state?.stage === "preview" && (
        <>
          <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <h2 className="mb-1 font-semibold">מיפוי עמודות · {state.filename}</h2>
            {state.agentMapped.length > 0 && (
              <p className="mb-2 flex items-center gap-1 text-xs text-violet-800">
                <Bot className="h-3.5 w-3.5" aria-hidden />
                עמודות שסומנו הן פרשנות הסוכן — בדוק אותן. הסוכן ממפה מבנה בלבד; ערכים לעולם אינם מומצאים.
              </p>
            )}
            <ActionForm action={remapImport} className="space-y-3">
              <div className="flex flex-wrap gap-3">
                {state.headers.map((h, i) => (
                  <div key={i} className={`flex flex-col rounded-md border p-2 ${state.agentMapped.includes(h) ? "border-violet-300 bg-violet-50" : "border-border"}`}>
                    <span className="mb-1 text-xs font-medium">
                      {state.agentMapped.includes(h) && <Bot className="ms-1 inline h-3 w-3 text-violet-700" aria-hidden />} {h}
                    </span>
                    <select name={`col_${i}`} defaultValue={state.mapping[i]?.target ?? "ignore"} className={inputCls}>
                      {targets.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <PendingButton
                pendingLabel="מחשב מחדש…"
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                חשב מחדש עם המיפוי המתוקן
              </PendingButton>
            </ActionForm>
          </section>

          <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">מה יקרה</h2>
              <span className="text-sm">
                <b className="text-green-700">{state.plan.counts.create} ייווצרו</b> ·{" "}
                {state.plan.counts.skip} ידולגו · {state.plan.counts.error} שגיאות
                {state.plan.counts.halt > 0 && <> · <b className="text-amber-700">{state.plan.counts.halt} ייתכנו כפילים</b></>}
              </span>
            </div>
            <ul className="max-h-96 divide-y divide-border/60 overflow-auto text-sm">
              {state.plan.rows.map((r) => (
                <li key={r.row} className="flex flex-wrap items-center gap-2 py-1.5">
                  <span className="w-10 text-xs text-muted">{r.row}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${KIND_STYLE[r.kind].cls}`}>{KIND_STYLE[r.kind].label}</span>
                  <span className="font-medium">{r.name}</span>
                  {r.kind === "create" && (
                    <span className="text-xs text-muted">→ {r.teamPath ?? "ללא מסגרת"}</span>
                  )}
                  {/* ?? [] — a preview stored before the warnings field existed
                      must render, not crash; its rows simply carry no warnings */}
                  {r.kind === "create" && (r.warnings ?? []).length > 0 && (
                    <span className="text-xs text-amber-800">⚠ {(r.warnings ?? []).join(" · ")}</span>
                  )}
                  {"personId" in r && (
                    <Link href={`/people/${r.personId}`} target="_blank" className="text-xs text-brand-700 hover:underline">
                      לכרטיס הקיים ←
                    </Link>
                  )}
                  {"reason" in r && <span className="text-xs text-muted">{r.reason}</span>}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-3">
              <ActionForm action={approveImport}>
                {state.plan.counts.create === 0 ? (
                  <button disabled className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white opacity-40">
                    אשר וצור 0 אנשים
                  </button>
                ) : (
                  <PendingButton
                    pendingLabel="מתחיל ביצוע…"
                    className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    אשר וצור {state.plan.counts.create} אנשים
                  </PendingButton>
                )}
              </ActionForm>
              <ActionForm action={dismissImport}>
                <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">בטל</button>
              </ActionForm>
              <span className="text-xs text-muted">אישור אחד לכל הקובץ. שגיאות וכפילים אינם נכתבים.</span>
            </div>
          </section>
        </>
      )}

      {state?.stage === "executing" && (
        <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
          <AutoRefresh ms={1500} />
          <h2 className="mb-2 font-semibold">מייבא…</h2>
          <p className="text-sm">
            שורה {state.progress?.done ?? 0} מתוך {state.progress?.total ?? 0}
          </p>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${state.progress && state.progress.total > 0 ? Math.round((state.progress.done / state.progress.total) * 100) : 0}%` }}
            />
          </div>
        </section>
      )}

      {state?.stage === "done" && state.report && (
        <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden />
            הייבוא הושלם · {state.filename}
          </h2>
          <p className="text-sm">
            נוצרו <b>{state.report.created}</b> · דולגו {state.report.skipped} · שגיאות {state.report.errors}
          </p>
          {state.report.downgraded.length > 0 && (
            <div className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <p className="mb-1 flex items-center gap-1 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                דילוגים בזמן הביצוע — התצוגה המקדימה התיישנה בינתיים:
              </p>
              <ul className="list-inside list-disc">
                {state.report.downgraded.map((d, i) => (<li key={i}>{d}</li>))}
              </ul>
            </div>
          )}
          <ActionForm action={dismissImport} className="mt-3">
            <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">סגור דוח</button>
          </ActionForm>
        </section>
      )}

      <section className="space-y-4 border-t border-border/70 pt-6">
        <div>
          <h2 className="text-xl font-bold">עדכון נתונים חיצוני</h2>
          <p className="mt-1 text-sm text-muted">
            הקובץ השבועי ממערכת-האב. רק אנשים קיימים מתעדכנים; כל שינוי מוצג ״נוכחי ← מוצע״ ומאושר שדה-שדה. הקובץ אינו
            דורס: תיקון ידני במערכת שורד כל עוד התא בקובץ לא השתנה.
          </p>
        </div>

        {!upd && (
          <ActionForm action={uploadUpdateFile} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <input type="file" name="file" accept=".csv,.xlsx,.xls" required className="text-sm" />
            <PendingButton
              pendingLabel="קורא ומשווה… (מבנה חדש נשלח לסוכן — עד דקה)"
              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              העלה קובץ עדכון
            </PendingButton>
            {snapshots.length > 0 && (
              <span className="w-full text-xs text-muted">
                היסטוריה: {snapshots.map((s) => `${s.filename} (${new Intl.DateTimeFormat("he-IL").format(s.uploadedAt)} · ${s.uploadedByName})`).join(" · ")}{" "}
                ·{" "}
                <a href="/hr/last-import" className="text-brand-700 hover:underline">
                  הורד את הקובץ האחרון
                </a>{" "}
                — לבדוק מהו הפורמט האחרון
              </span>
            )}
          </ActionForm>
        )}

        {upd?.stage === "structure-gate" && upd.structure && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="mb-2 font-medium text-amber-900">מבנה הקובץ שונה מהקובץ הקודם:</p>
            {upd.structure.appeared.length > 0 && <p>עמודות חדשות: {upd.structure.appeared.join(", ")}</p>}
            {upd.structure.vanished.length > 0 && <p>עמודות שנעלמו: {upd.structure.vanished.join(", ")}</p>}
            <p className="mt-2 text-xs text-amber-800">
              בהמשך, עמודות מוכרות ישמרו את מיפוין וימופו רק החדשות — לאישורך.
            </p>
            <div className="mt-3 flex gap-2">
              <ActionForm action={acceptStructureChange}>
                <PendingButton pendingLabel="ממפה…" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700">
                  המשך למיפוי
                </PendingButton>
              </ActionForm>
              <ActionForm action={dismissUpdateRun}>
                <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">בטל</button>
              </ActionForm>
            </div>
          </div>
        )}

        {upd?.stage === "mapping" && (
          <ActionForm action={approveUpdateMapping} className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <h3 className="font-semibold">מיפוי עמודות · {upd.filename}</h3>
            <p className="text-xs text-muted">
              עמודה יכולה להיות ממופה לכמה יעדים — סמן ✓ לכל יעד; ללא סימון = התעלם. המיפוי נשמר גלובלית באישור, לשימוש
              כל ההעלאות הבאות.
            </p>
            <div className="flex flex-wrap gap-3">
              {upd.headers.map((h, i) => (
                <div key={i} className="flex flex-col rounded-md border border-border p-2">
                  <span className="mb-1 text-xs font-medium">{h}</span>
                  <TargetPicker name={`col_${i}`} options={updateTargets} defaultSelected={upd.mapping[i]?.targets ?? []} />
                </div>
              ))}
            </div>
            <PendingButton pendingLabel="בונה הצעות…" className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              אשר מיפוי והמשך
            </PendingButton>
          </ActionForm>
        )}

        {upd?.stage === "review" && upd.plan && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold">{upd.filename}</span>
              <span className="text-muted">
                {upd.plan.people.length} אנשים עם שינויים · {upd.plan.skippedUnknown} לא במערכת (דולגו) ·{" "}
                {upd.plan.skippedOutOfScope} מחוץ לתחומך
              </span>
              {upd.plan.warnings.map((w, i) => (
                <span key={i} className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">⚠ {w}</span>
              ))}
            </div>
            {reviewPeople.length === 0 ? (
              <div className="rounded-xl border border-border/70 bg-card p-6 text-sm text-muted shadow-sm">
                אין שינויים לסקירה — הקובץ תואם את המערכת. אפשר לסיים ולשמור להיסטוריה.
                <div className="mt-3 flex gap-2">
                  <ActionForm action={concludeUpdateRun}>
                    <button className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700">סיים ושמור</button>
                  </ActionForm>
                  <ActionForm action={dismissUpdateRun}>
                    <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">בטל</button>
                  </ActionForm>
                </div>
              </div>
            ) : (
              <HrUpdateReview people={reviewPeople} resolve={resolveProposalItem} conclude={concludeUpdateRun} dismiss={dismissUpdateRun} />
            )}
          </div>
        )}
      </section>

      <section className="space-y-4 border-t border-border/70 pt-6">
        <div>
          <h2 className="text-xl font-bold">עדכוני כוח אדם</h2>
          <p className="mt-1 text-sm text-muted">
            כל תנועות האנשים — נוצר, עבר, נמחק, עזב — בחתך יומי. תנועה נראית אם המקור או היעד בתחום העריכה שלך; מעבר אל
            מחוץ לתחום נשאר גלוי.
          </p>
        </div>

        <form method="get" action="/hr" className="flex flex-wrap items-end gap-2">
          <a href={`/hr?day=${prevDay}${mkind ? `&mkind=${mkind}` : ""}`} className="rounded-md border border-border px-2 py-1.5 text-sm hover:bg-slate-50">→ יום קודם</a>
          <DateField name="day" label="תאריך" defaultDate={day} className={`${inputCls} w-40`} />
          <a href={`/hr?day=${nextDay}${mkind ? `&mkind=${mkind}` : ""}`} className="rounded-md border border-border px-2 py-1.5 text-sm hover:bg-slate-50">יום הבא ←</a>
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-muted">סוג</label>
            <select name="mkind" defaultValue={mkind ?? ""} className={inputCls}>
              <option value="">הכול</option>
              {Object.entries(MOVEMENT_META).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-muted">מסגרת</label>
            <select name="mteam" defaultValue={mteam ?? ""} className={inputCls}>
              <option value="">הכול</option>
              {scopeTeams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-muted">מבצע</label>
            <select name="mactor" defaultValue={mactor ?? ""} className={inputCls}>
              <option value="">הכול</option>
              {movementActors.map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
            </select>
          </div>
          <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">סנן</button>
        </form>

        {movements.length === 0 ? (
          <p className="rounded-xl border border-border/70 bg-card p-6 text-sm text-muted shadow-sm">
            אין תנועות ב-{formatIsraeliDate(day)} תחת המסננים שנבחרו.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card shadow-sm">
            {movements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                <span className="w-12 text-xs text-muted">
                  {new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(m.at)}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-xs ${MOVEMENT_META[m.kind].cls}`}>{MOVEMENT_META[m.kind].label}</span>
                {m.personExists ? (
                  <Link href={`/people/${m.personId}`} className="font-medium text-brand-700 hover:underline">
                    {m.personName}
                  </Link>
                ) : (
                  <span className="font-medium" title="האדם כבר אינו במערכת">{m.personName}</span>
                )}
                <span className="text-xs text-muted">
                  {m.fromPath || m.toPath
                    ? `${m.fromPath ?? "ללא שיוך"} ← ${m.toPath ?? "ללא שיוך"}`
                    : ""}
                </span>
                <span className="ms-auto text-xs text-muted">
                  {m.actorName} · {SOURCE_LABEL[m.source] ?? m.source}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
