"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDelete, plural } from "@/components/ConfirmDelete";
import { ActionForm } from "@/components/ActionForm";
import { copyPlan, removePlan } from "@/lib/plan-actions";

/**
 * The admin controls on a plans-list row. A small client island so the page
 * itself stays a server component and keeps loading its data as it does.
 */
export function PlanRowActions({
  planId,
  name,
  pointEvents,
  cumulativeMetrics,
  recurringEvents,
  assignedEverywhere,
}: {
  planId: string;
  name: string;
  pointEvents: number;
  cumulativeMetrics: number;
  recurringEvents: number;
  /** people holding a copy, across the whole system — not clipped to the viewer */
  assignedEverywhere: number;
}) {
  const [confirming, setConfirming] = useState(false);

  const items = [
    pointEvents && plural(pointEvents, "אירוע נקודתי", "אירועים נקודתיים"),
    cumulativeMetrics && plural(cumulativeMetrics, "מדד מצטבר", "מדדים מצטברים"),
    recurringEvents && plural(recurringEvents, "אירוע מחזורי", "אירועים מחזוריים"),
  ].filter((l): l is string => typeof l === "string");

  return (
    <div className="flex items-center gap-2">
      <ActionForm action={copyPlan}>
        <input type="hidden" name="planId" value={planId} />
        <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">שכפל</button>
      </ActionForm>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title={`מחק את ${name}`}
        className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>

      {confirming && (
        <ConfirmDelete
          title={`מחיקת התכנית ״${name}״`}
          confirmLabel="מחק את התכנית"
          onCancel={() => setConfirming(false)}
          action={removePlan}
          hidden={{ planId }}
        >
          {items.length > 0 ? (
            <>
              <p className="text-red-800">יימחקו יחד עם התכנית:</p>
              <ul className="space-y-0.5 rounded-md bg-red-50 px-3 py-2 text-red-900">
                {items.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-muted">התכנית ריקה — לא הוגדרו בה אירועים.</p>
          )}

          {assignedEverywhere > 0 ? (
            <p className="text-amber-800">
              {plural(assignedEverywhere, "איש מחזיק", "אנשים מחזיקים")} כרגע עותק של התכנית הזו.{" "}
              <b>המסלול שלהם, ההתקדמות שנרשמה והפערים שלהם לא ישתנו</b> — הם נמדדים מול העותק האישי, לא מול התבנית.
              השינוי היחיד: שם המסלול ברשימת האנשים יפסיק להיות קישור.
            </p>
          ) : (
            <p className="text-muted">אף אחד אינו משויך לתכנית הזו.</p>
          )}
        </ConfirmDelete>
      )}
    </div>
  );
}
