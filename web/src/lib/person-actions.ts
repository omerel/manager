"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireAdmin,
  requireEditForNode,
  requireEditForPerson,
  requireEstablishForNode,
  requireEstablishForPerson,
} from "@/lib/authz";
import type { EmploymentStatus, FieldType } from "@/generated/prisma/client";
import { composeFullName } from "@/lib/person-name";
import { deleteUploadDir } from "@/lib/storage";
import { logActivity } from "@/lib/activity-log";
import { assertIdentityFree } from "@/lib/identity-keys";
import { emitMovement } from "@/lib/movements";
import { monthsSince } from "@/lib/waivers";
import { parseIsraeliDate } from "@/lib/dates";
import { parseYearsMonths } from "@/lib/years-months";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}
/**
 * A date from a form, read the Israeli way. Returns null for empty AND for
 * malformed input, so a value the system could not understand is never stored:
 * the required-field checks that already throw on a missing date cover the
 * malformed case for free.
 */
function dateOrNull(v: FormDataEntryValue | null): Date | null {
  return parseIsraeliDate(str(v));
}
function statusOf(v: FormDataEntryValue | null): EmploymentStatus {
  const s = str(v);
  return s === "PLANNED_END" || s === "DEPARTED" ? (s as EmploymentStatus) : "ACTIVE";
}

/* ---------- Person-card schema (Admin) ---------- */

export async function addFieldDef(formData: FormData) {
  await requireAdmin();
  const label = str(formData.get("label")) || "שדה";
  const type = (["TEXT", "DATE", "NUMBER", "ENUM"].includes(str(formData.get("type"))) ? str(formData.get("type")) : "TEXT") as FieldType;
  const required = str(formData.get("required")) === "on";
  const options = str(formData.get("options"))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // A stable, unique key derived from label + a short suffix from the current count.
  const count = await prisma.personFieldDef.count();
  const key = `f${count + 1}_${label.replace(/\s+/g, "_")}`;
  await prisma.personFieldDef.create({ data: { key, label, type, required, options, order: count } });
  await logActivity({ action: "schema.field.add", description: `הוסיף שדה כרטיס ״${label}״`, subjectType: "schema" });
  revalidatePath("/people/card-schema");
}

export async function removeFieldDef(formData: FormData) {
  await requireAdmin();
  const fieldId = str(formData.get("id"));
  const gone = await prisma.personFieldDef.findUnique({ where: { id: fieldId }, select: { label: true } });
  await prisma.personFieldDef.delete({ where: { id: fieldId } });
  await logActivity({ action: "schema.field.delete", description: `מחק את שדה הכרטיס ״${gone?.label ?? fieldId}״`, subjectType: "schema" });
  revalidatePath("/people/card-schema");
  revalidatePath("/hierarchy");
}

/** Edit an existing field definition. Stored person values are kept as-is. */
export async function updateFieldDef(formData: FormData) {
  await requireAdmin();
  const id = str(formData.get("id"));
  const label = str(formData.get("label"));
  if (!label) throw new Error("יש להזין שם שדה.");
  const type = (["TEXT", "DATE", "NUMBER", "ENUM"].includes(str(formData.get("type"))) ? str(formData.get("type")) : "TEXT") as FieldType;
  const required = str(formData.get("required")) === "on";
  const options =
    type === "ENUM"
      ? str(formData.get("options"))
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  await prisma.personFieldDef.update({ where: { id }, data: { label, type, required, options } });
  await logActivity({ action: "schema.field.update", description: `ערך את שדה הכרטיס ״${label}״`, subjectType: "schema" });
  revalidatePath("/people/card-schema");
  revalidatePath("/hierarchy");
  redirect("/people/card-schema");
}

/** Move a field up/down in the display order. */
export async function moveFieldDef(formData: FormData) {
  await requireAdmin();
  const id = str(formData.get("id"));
  const dir = str(formData.get("dir")) === "up" ? -1 : 1;
  const defs = await prisma.personFieldDef.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] });
  const idx = defs.findIndex((d) => d.id === id);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= defs.length) return; // edge — nothing to do
  [defs[idx], defs[target]] = [defs[target], defs[idx]];
  // normalize orders 0..n-1 (also heals any historical duplicates)
  await prisma.$transaction(
    defs.map((d, i) => prisma.personFieldDef.update({ where: { id: d.id }, data: { order: i } })),
  );
  revalidatePath("/people/card-schema");
}

/** Add an option to a closed list (ENUM field), e.g. a new specialty. */
export async function addEnumOption(formData: FormData) {
  await requireAdmin();
  const fieldId = str(formData.get("fieldId"));
  const option = str(formData.get("option"));
  if (!option) throw new Error("יש להזין ערך.");
  const def = await prisma.personFieldDef.findUnique({ where: { id: fieldId } });
  if (!def || def.type !== "ENUM") throw new Error("שדה רשימה לא נמצא.");
  if (def.options.includes(option)) throw new Error("הערך כבר קיים ברשימה.");
  await prisma.personFieldDef.update({ where: { id: fieldId }, data: { options: [...def.options, option] } });
  revalidatePath("/hierarchy");
  revalidatePath("/people/card-schema");
}

/** Remove an option from a closed list. Existing person values keep their old text. */
export async function removeEnumOption(formData: FormData) {
  await requireAdmin();
  const fieldId = str(formData.get("fieldId"));
  const option = str(formData.get("option"));
  const def = await prisma.personFieldDef.findUnique({ where: { id: fieldId } });
  if (!def || def.type !== "ENUM") throw new Error("שדה רשימה לא נמצא.");
  await prisma.personFieldDef.update({
    where: { id: fieldId },
    data: { options: def.options.filter((o) => o !== option) },
  });
  revalidatePath("/hierarchy");
  revalidatePath("/people/card-schema");
}

/* ---------- Person create / update (Editor on the team) ---------- */

async function collectFieldValues(formData: FormData) {
  const defs = await prisma.personFieldDef.findMany();
  const values: { fieldDefId: string; value: string; order: number }[] = [];
  const labeled: { label: string; value: string }[] = [];
  for (const def of defs) {
    const v = str(formData.get(`field_${def.id}`));
    if (v) {
      values.push({ fieldDefId: def.id, value: v, order: def.order });
      labeled.push({ label: def.label, value: v });
    }
  }
  return { values, labeled };
}

/** Reassign (or first-assign) a person to a team. Requires EDIT on the target team. */
export async function reassignTeam(formData: FormData) {
  const personId = str(formData.get("personId"));
  const teamId = str(formData.get("teamId"));
  await requireEditForNode(teamId); // must be able to edit the destination
  const team = await prisma.orgNode.findUnique({ where: { id: teamId } });
  if (!team || team.kind !== "TEAM") throw new Error("יש לשייך לצוות (צומת מסוג צוות).");
  // the movement needs WHERE FROM — read before the update erases it
  const before = await prisma.person.findUnique({ where: { id: personId }, select: { teamId: true } });
  const previousTeamId = before?.teamId ?? null;
  await prisma.person.update({ where: { id: personId }, data: { teamId } });
  const moved = await prisma.person.findUnique({ where: { id: personId }, select: { fullName: true } });
  await logActivity({ action: "person.reassign", description: `שייך את ${moved?.fullName ?? personId} ל${team.name}`, subjectType: "person", subjectId: personId });
  await emitMovement({ kind: "MOVED", personId, personName: moved?.fullName ?? personId, fromTeamId: previousTeamId, toTeamId: teamId, source: "manual" });
  revalidatePath(`/people/${personId}`);
  revalidatePath("/people");
}

export async function createPerson(formData: FormData) {
  const teamId = str(formData.get("teamId"));
  // enrolling is an establishment act, not data entry — section level and above
  await requireEstablishForNode(teamId);

  const team = await prisma.orgNode.findUnique({ where: { id: teamId } });
  if (!team || team.kind !== "TEAM") throw new Error("יש לשייך איש לצוות (צומת מסוג צוות).");

  const recruitmentDate = dateOrNull(formData.get("recruitmentDate"));
  if (!recruitmentDate) throw new Error("חובה להזין תאריך גיוס.");
  const placementDate = dateOrNull(formData.get("placementDate"));
  if (!placementDate) throw new Error("חובה להזין תאריך הצבה ביחידה — ממנו נגזרים כל מועדי התכנית.");
  const firstName = str(formData.get("firstName"));
  const lastName = str(formData.get("lastName"));
  if (!firstName || !lastName) throw new Error("חובה להזין שם פרטי ושם משפחה.");
  const birthDate = dateOrNull(formData.get("birthDate"));
  if (!birthDate) throw new Error("חובה להזין תאריך לידה.");

  const { values, labeled } = await collectFieldValues(formData);
  await assertIdentityFree(labeled);
  const person = await prisma.person.create({
    data: {
      firstName,
      lastName,
      fullName: composeFullName(firstName, lastName),
      birthDate,
      recruitmentDate,
      placementDate,
      status: statusOf(formData.get("status")),
      endOfServiceDate: dateOrNull(formData.get("endOfServiceDate")),
      teamId,
      fieldValues: { create: values },
    },
  });

  // optional profile photo
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0 && photo.type.startsWith("image/")) {
    const { saveUpload } = await import("@/lib/storage");
    const { storagePath } = await saveUpload(person.id, photo);
    await prisma.person.update({ where: { id: person.id }, data: { photoPath: storagePath } });
  }

  // if this creation came from a document draft, the draft is now consumed
  const draftId = str(formData.get("draftId"));
  if (draftId) await prisma.personDraft.deleteMany({ where: { id: draftId } });

  // before the redirect: redirect() throws to unwind, so anything after it never runs
  await logActivity({ action: "person.create", description: `יצר את ${person.fullName}`, subjectType: "person", subjectId: person.id });
  // a draftId marks the intake channel — the same action serves both doors
  await emitMovement({
    kind: "CREATED", personId: person.id, personName: person.fullName, toTeamId: person.teamId,
    source: str(formData.get("draftId")) ? "intake" : "manual",
  });
  redirect(`/people/${person.id}`);
}

export async function updatePerson(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);

  const recruitmentDate = dateOrNull(formData.get("recruitmentDate"));
  if (!recruitmentDate) throw new Error("חובה להזין תאריך גיוס.");
  const placementDate = dateOrNull(formData.get("placementDate"));
  if (!placementDate) throw new Error("חובה להזין תאריך הצבה ביחידה — ממנו נגזרים כל מועדי התכנית.");
  const firstName = str(formData.get("firstName"));
  const lastName = str(formData.get("lastName"));
  if (!firstName || !lastName) throw new Error("חובה להזין שם פרטי ושם משפחה.");
  const birthDate = dateOrNull(formData.get("birthDate"));
  if (!birthDate) throw new Error("חובה להזין תאריך לידה.");
  const { values, labeled } = await collectFieldValues(formData);
  // an identity value belongs to one person — refused by name, own values pass
  await assertIdentityFree(labeled, personId);

  // departure is a TRANSITION: emitted only when the stored status was not
  // already עזב, so re-editing a departed person's card stays silent
  const statusBefore = await prisma.person.findUnique({ where: { id: personId }, select: { status: true, teamId: true, fullName: true } });

  await prisma.$transaction([
    prisma.person.update({
      where: { id: personId },
      data: {
        firstName,
        lastName,
        fullName: composeFullName(firstName, lastName),
        birthDate,
        recruitmentDate,
        placementDate,
        status: statusOf(formData.get("status")),
        endOfServiceDate: dateOrNull(formData.get("endOfServiceDate")),
      },
    }),
    prisma.personFieldValue.deleteMany({ where: { personId } }),
    prisma.personFieldValue.createMany({ data: values.map((v) => ({ personId, ...v })) }),
  ]);
  await logActivity({
    action: "person.update",
    description: `ערך את ${composeFullName(firstName, lastName)}`,
    subjectType: "person",
    subjectId: personId,
  });
  const statusNow = statusOf(formData.get("status"));
  if (statusNow === "DEPARTED" && statusBefore?.status !== "DEPARTED") {
    await emitMovement({
      kind: "DEPARTED", personId, personName: composeFullName(firstName, lastName),
      fromTeamId: statusBefore?.teamId, source: "status",
    });
  }
  revalidatePath(`/people/${personId}`);
}

/* ---------- Plan assignment (Editor on the team) ---------- */

/**
 * Assign a plan. The person's previous assignment is ENDED, never deleted:
 * milestones, readings and evaluations are children of the copy's items and
 * would cascade away with it, which is how reassignment used to erase a
 * person's record.
 *
 * The form carries the review decisions — which items to require despite
 * predating the assignment, which to waive despite falling after it, and what
 * to carry over from the plan being left.
 */
export async function assignPlan(formData: FormData) {
  const personId = str(formData.get("personId"));
  const templateId = str(formData.get("templateId"));
  await requireEditForPerson(personId);

  const tpl = await prisma.careerPlan.findUnique({
    where: { id: templateId },
    include: {
      pointEvents: true,
      recurringEvents: true,
      cumulativeMetrics: { include: { checkpoints: true } },
    },
  });
  if (!tpl || !tpl.isTemplate) throw new Error("תבנית לא נמצאה.");

  const person = await prisma.person.findUniqueOrThrow({
    where: { id: personId },
    select: { placementDate: true, assignedPlanId: true },
  });
  // personal events belong to the PERSON, not to the track they are leaving —
  // so they are carried onto the new copy rather than re-approved every move
  const personalEvents = person.assignedPlanId
    ? await prisma.pointEvent.findMany({
        where: { planId: person.assignedPlanId, personal: true },
        select: { label: true, offsetMonths: true, createdByName: true },
      })
    : [];

  const now = new Date();
  // measured on the plan's own axis: months in this unit, not total service
  const waiverOffsetMonths = monthsSince(person.placementDate, now);
  const reason = str(formData.get("reason")) || null;

  // Build the copy item by item so every template id maps to its copy id —
  // the review screen's decisions are keyed by template item.
  const copy = await prisma.careerPlan.create({
    data: { name: tpl.name, isTemplate: false, sourceTemplateId: tpl.id },
  });
  const pointIdOf = new Map<string, string>();
  for (const e of tpl.pointEvents) {
    const c = await prisma.pointEvent.create({
      // sourceEventId is how the copy finds the template item's «פורמטים
      // והנחיות» file at read time — the guideline is never copied, only
      // pointed at, so replacing it reaches everyone already assigned
      data: { planId: copy.id, label: e.label, offsetMonths: e.offsetMonths, sourceEventId: e.id },
    });
    pointIdOf.set(e.id, c.id);
  }
  // the person's own obligations, re-created on the new copy. They are NOT in
  // `pointIdOf`: that map exists to translate TEMPLATE ids into copy ids for
  // the review screen's decisions, and a personal event has no template id.
  for (const e of personalEvents) {
    await prisma.pointEvent.create({
      data: { planId: copy.id, label: e.label, offsetMonths: e.offsetMonths, personal: true, createdByName: e.createdByName },
    });
  }
  const metricIdOf = new Map<string, string>();
  const checkpointIdOf = new Map<string, string>();
  for (const m of tpl.cumulativeMetrics) {
    const c = await prisma.cumulativeMetric.create({
      data: { planId: copy.id, name: m.name, unit: m.unit, color: m.color },
    });
    metricIdOf.set(m.id, c.id);
    for (const cp of m.checkpoints) {
      const ccp = await prisma.metricCheckpoint.create({
        data: { metricId: c.id, offsetMonths: cp.offsetMonths, target: cp.target },
      });
      checkpointIdOf.set(cp.id, ccp.id);
    }
  }
  const recurringIdOf = new Map<string, string>();
  for (const r of tpl.recurringEvents) {
    const c = await prisma.recurringEvent.create({
      data: {
        planId: copy.id,
        label: r.label,
        intervalMonths: r.intervalMonths,
        startOffsetMonths: r.startOffsetMonths,
        display: r.display,
        stopMode: "UNTIL_OFFSET",
        stopOffsetMonths: r.stopOffsetMonths,
        withScore: r.withScore,
        sourceEventId: r.id, // as above: the guideline is read through this
        color: r.color,
      },
    });
    recurringIdOf.set(r.id, c.id);
  }

  // end the outgoing assignment, open the new one
  if (person.assignedPlanId) {
    await prisma.planAssignment.updateMany({
      where: { personId, planId: person.assignedPlanId, endedAt: null },
      data: { endedAt: now, reason },
    });
  }
  const assignment = await prisma.planAssignment.create({
    data: {
      personId,
      planId: copy.id,
      templateName: tpl.name,
      assignedAt: now,
      waiverOffsetMonths,
    },
  });
  await prisma.person.update({ where: { id: personId }, data: { assignedPlanId: copy.id } });

  // Overrides: only deviations from the line are stored. An unchecked checkbox
  // submits nothing, so the form sends every item's ref plus the checked ones;
  // an item present in the list but not checked is one the Admin waived.
  const allRefs = str(formData.get("items")).split(",").filter(Boolean);
  const required = new Set(formData.getAll("require").map(String));
  const offsetOfPoint = new Map(tpl.pointEvents.map((e) => [e.id, e.offsetMonths]));
  const offsetOfCheckpoint = new Map(
    tpl.cumulativeMetrics.flatMap((m) => m.checkpoints.map((c) => [c.id, c.offsetMonths] as const)),
  );

  for (const ref of allRefs) {
    const [kind, id, occ] = ref.split("|");
    const waived = !required.has(ref);

    if (kind === "point" && pointIdOf.has(id)) {
      if (waived === ((offsetOfPoint.get(id) ?? 0) <= waiverOffsetMonths)) continue; // agrees with the line
      await prisma.planWaiver.create({
        data: { assignmentId: assignment.id, pointEventId: pointIdOf.get(id)!, waived },
      });
    } else if (kind === "checkpoint" && checkpointIdOf.has(id)) {
      if (waived === ((offsetOfCheckpoint.get(id) ?? 0) <= waiverOffsetMonths)) continue;
      await prisma.planWaiver.create({
        data: { assignmentId: assignment.id, checkpointId: checkpointIdOf.get(id)!, waived },
      });
    } else if (kind === "recurring" && recurringIdOf.has(id)) {
      const occurrenceOffset = Number(occ);
      if (!Number.isFinite(occurrenceOffset)) continue;
      if (waived === (occurrenceOffset <= waiverOffsetMonths)) continue;
      await prisma.planWaiver.create({
        data: {
          assignmentId: assignment.id,
          recurringEventId: recurringIdOf.get(id)!,
          occurrenceOffset,
          waived,
        },
      });
    }
  }

  // Carry-over: the credit itself is an ordinary progress record on the new
  // copy; the PlanCarryOver row is what lets the card say where it came from.
  const previousPlanName = str(formData.get("previousPlanName")) || "מסלול קודם";
  for (const carry of formData.getAll("carry").map(String)) {
    const [kind, fromId, toId] = carry.split("|");

    if (kind === "METRIC") {
      const reading = await prisma.metricReading.findFirst({ where: { personId, metricId: fromId } });
      const toMetricId = metricIdOf.get(toId);
      if (!reading || !toMetricId) continue;
      await prisma.metricReading.create({
        data: { personId, metricId: toMetricId, value: reading.value, asOf: reading.asOf, note: reading.note },
      });
      const src = tpl.cumulativeMetrics.find((m) => m.id === toId);
      await prisma.planCarryOver.create({
        data: {
          assignmentId: assignment.id,
          kind: "METRIC",
          fromPlanName: previousPlanName,
          fromLabel: src ? `${src.name} (${src.unit})` : "מדד",
          toMetricId,
          value: reading.value,
          originalDate: reading.asOf,
        },
      });
    } else if (kind === "POINT") {
      const prog = await prisma.pointProgress.findFirst({ where: { personId, pointEventId: fromId } });
      const toPointEventId = pointIdOf.get(toId);
      if (!prog || !toPointEventId) continue;
      await prisma.pointProgress.create({
        data: { personId, pointEventId: toPointEventId, doneOn: prog.doneOn, note: prog.note },
      });
      await prisma.planCarryOver.create({
        data: {
          assignmentId: assignment.id,
          kind: "POINT",
          fromPlanName: previousPlanName,
          fromLabel: tpl.pointEvents.find((e) => e.id === toId)?.label ?? "אירוע",
          toPointEventId,
          originalDate: prog.doneOn,
        },
      });
    }
  }

  revalidatePath(`/people/${personId}`);
  revalidatePath("/");
  redirect(`/people/${personId}?edit=1`);
}

/** Ends the assignment; the copy and everything recorded against it are kept. */
export async function unassignPlan(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);
  const prev = await prisma.person.findUnique({ where: { id: personId }, select: { assignedPlanId: true } });
  if (prev?.assignedPlanId) {
    await prisma.planAssignment.updateMany({
      where: { personId, planId: prev.assignedPlanId, endedAt: null },
      data: { endedAt: new Date(), reason: str(formData.get("reason")) || null },
    });
  }
  await prisma.person.update({ where: { id: personId }, data: { assignedPlanId: null } });
  const off = await prisma.person.findUnique({ where: { id: personId }, select: { fullName: true } });
  await logActivity({ action: "plan.unassign", description: `סיים את שיוך המסלול של ${off?.fullName ?? personId}`, subjectType: "person", subjectId: personId });
  revalidatePath(`/people/${personId}`);
  revalidatePath("/");
}

/**
 * Delete a person and everything that exists only because they did.
 *
 * The cascades take most of it, but not the per-person plan copies: a copy
 * holds no reference back to its person (the arrow runs Person → CareerPlan and
 * PlanAssignment → CareerPlan), so nothing removes it automatically. Measured
 * on the dev database, a naive person.delete left 2 copies and 14 plan items
 * behind for a single person. They are deleted here, explicitly.
 *
 * Order inside the transaction: the person goes first, so the copies are
 * already unreferenced when they go and no foreign key can fail midway.
 */
export async function removePerson(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEstablishForPerson(personId);
  const person = await prisma.person.findUnique({
    where: { id: personId },
    // fullName is read for the activity entry: after the delete there is
    // nothing left to name them by
    select: { id: true, fullName: true, teamId: true, assignedPlanId: true, planAssignments: { select: { planId: true } } },
  });
  if (!person) throw new Error("איש לא נמצא.");

  // both routes to a copy: an assignment row, and the active pointer. A copy
  // missing from one is still caught by the other.
  const copyIds = [...new Set([...person.planAssignments.map((a) => a.planId), person.assignedPlanId].filter((v): v is string => v !== null))];

  await prisma.$transaction(async (tx) => {
    await tx.person.delete({ where: { id: personId } });
    if (copyIds.length) {
      // isTemplate guard: a copy is what we mean to take, never a template that
      // a bad pointer happened to name.
      await tx.careerPlan.deleteMany({ where: { id: { in: copyIds }, isTemplate: false } });
    }
  });

  // after the commit, and best-effort — see deleteUploadDir
  await deleteUploadDir(personId);

  await logActivity({ action: "person.delete", description: `מחק את ${person.fullName}`, subjectType: "person", subjectId: personId });
  await emitMovement({ kind: "REMOVED", personId, personName: person.fullName, fromTeamId: person.teamId, source: "manual" });

  revalidatePath("/people");
  revalidatePath("/plans");
  revalidatePath("/hierarchy");
  revalidatePath("/", "layout");
}

/* ---------- Personal events (section level and above) ---------- */

/**
 * A point event that belongs to ONE person rather than to their track.
 *
 * It lives on their own plan copy — which already belongs to exactly them — so
 * it is a point event in every mechanical sense: it is measured, it counts
 * toward gaps, it can be marked done and it can be waived. `personal` is what
 * keeps it from being mistaken for something the track requires, and what lets
 * it travel with the person when they are moved to another plan.
 *
 * Authority is the establishment rule, not plain EDIT: adding an obligation to
 * someone's path is the same kind of act as enrolling them.
 */
export async function addPersonalEvent(formData: FormData) {
  const personId = str(formData.get("personId"));
  const me = await requireEstablishForPerson(personId);
  const label = str(formData.get("label"));
  if (!label) throw new Error("שם האירוע לא יכול להיות ריק.");
  const offsetMonths = parseYearsMonths(str(formData.get("offset")));
  if (offsetMonths === null) {
    throw new Error("מועד האירוע: יש להזין שנים.חודשים (למשל 1.6 = שנה וחצי מההצבה; החודשים 0–11).");
  }

  const person = await prisma.person.findUniqueOrThrow({
    where: { id: personId },
    select: { fullName: true, assignedPlanId: true },
  });
  // without a plan there is no copy to hang it on, and no vector to draw it on
  if (!person.assignedPlanId) {
    throw new Error("כדי להוסיף אירוע אישי יש לשייך תחילה מסלול קריירה לאיש.");
  }

  await prisma.pointEvent.create({
    data: { planId: person.assignedPlanId, label, offsetMonths, personal: true, createdByName: me.name },
  });
  await logActivity({
    action: "person.personalEvent",
    description: `הוסיף אירוע אישי ״${label}״ עבור ${person.fullName}`,
    subjectType: "person",
    subjectId: personId,
  });
  revalidatePath(`/people/${personId}`);
  revalidatePath("/");
}

/** Remove a personal event. Only a personal one — a track's event is not the commander's to delete. */
export async function removePersonalEvent(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEstablishForPerson(personId);
  const id = str(formData.get("pointEventId"));
  const ev = await prisma.pointEvent.findUnique({ where: { id }, select: { label: true, personal: true, planId: true } });
  if (!ev?.personal) throw new Error("ניתן למחוק אירועים אישיים בלבד — אירוע של המסלול נערך בעמוד התכנית.");
  const person = await prisma.person.findUniqueOrThrow({ where: { id: personId }, select: { fullName: true, assignedPlanId: true } });
  // and only from THIS person's plan: an id from elsewhere is not theirs to touch
  if (ev.planId !== person.assignedPlanId) throw new Error("האירוע אינו שייך למסלול של איש זה.");

  await prisma.pointEvent.delete({ where: { id } });
  await logActivity({
    action: "person.personalEvent",
    description: `מחק את האירוע האישי ״${ev.label}״ של ${person.fullName}`,
    subjectType: "person",
    subjectId: personId,
  });
  revalidatePath(`/people/${personId}`);
  revalidatePath("/");
}

/* ---------- Progress recording (Editor on the team) ---------- */

export async function setPointDone(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);
  const pointEventId = str(formData.get("pointEventId"));
  const doneOn = dateOrNull(formData.get("doneOn")) ?? new Date();
  const note = str(formData.get("note")) || null;
  await prisma.pointProgress.upsert({
    where: { personId_pointEventId: { personId, pointEventId } },
    create: { personId, pointEventId, doneOn, note },
    update: { doneOn, note },
  });
  const ev = await prisma.pointEvent.findUnique({ where: { id: pointEventId }, select: { label: true } });
  const who = await prisma.person.findUnique({ where: { id: personId }, select: { fullName: true } });
  await logActivity({ action: "progress.point", description: `סימן ״${ev?.label ?? "אירוע"}״ כבוצע עבור ${who?.fullName ?? personId}`, subjectType: "person", subjectId: personId });
  revalidatePath(`/people/${personId}`);
}

export async function clearPointDone(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);
  await prisma.pointProgress.deleteMany({ where: { personId, pointEventId: str(formData.get("pointEventId")) } });
  revalidatePath(`/people/${personId}`);
}

export async function setMetricReading(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);
  const metricId = str(formData.get("metricId"));
  const value = Number(str(formData.get("value")));
  const asOf = dateOrNull(formData.get("asOf")) ?? new Date();
  const note = str(formData.get("note")) || null;
  if (!Number.isFinite(value)) throw new Error("ערך לא תקין.");
  await prisma.metricReading.upsert({
    where: { personId_metricId: { personId, metricId } },
    create: { personId, metricId, value, asOf, note },
    update: { value, asOf, note },
  });
  const metric = await prisma.cumulativeMetric.findUnique({ where: { id: metricId }, select: { name: true, unit: true } });
  const person2 = await prisma.person.findUnique({ where: { id: personId }, select: { fullName: true } });
  await logActivity({ action: "progress.metric", description: `רשם ${value} ${metric?.unit ?? ""} ב״${metric?.name ?? "מדד"}״ עבור ${person2?.fullName ?? personId}`, subjectType: "person", subjectId: personId });
  revalidatePath(`/people/${personId}`);
}
