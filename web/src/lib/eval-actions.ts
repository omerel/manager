"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatYearsMonths } from "@/lib/years-months";
import { requireEditForPerson } from "@/lib/authz";
import { logActivity } from "@/lib/activity-log";
import { parseIsraeliDate, addMonths } from "@/lib/dates";
import { parseScore } from "@/lib/eval-scale";
import { saveUpload } from "@/lib/storage";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

async function attachIfPresent(entryId: string, personId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  // Idempotence: a browser POST-resubmit (refresh) re-sends the same file — skip it.
  const dup = await prisma.attachment.findFirst({
    where: { entryId, filename: file.name, size: file.size },
  });
  if (dup) return;
  const { storagePath, size } = await saveUpload(personId, file);
  await prisma.attachment.create({
    data: { entryId, filename: file.name, storagePath, mimeType: file.type || "application/octet-stream", size },
  });
}

/** Post-Redirect-Get: land on a GET URL so a refresh can't re-run the mutation. */
function done(personId: string): never {
  revalidatePath(`/people/${personId}`);
  revalidatePath("/");
  redirect(`/people/${personId}?edit=1`);
}

/** Free-form entry (title + optional text + optional file). */
/**
 * When the event happened. Defaults to today, so writing something up the same
 * day costs nothing; a malformed date is refused rather than guessed, like
 * every other date in the system.
 */
function eventDateFrom(formData: FormData): Date {
  const raw = str(formData.get("eventDate"));
  if (!raw) return new Date();
  const d = parseIsraeliDate(raw);
  if (!d) throw new Error("תאריך האירוע לא תקין — נדרש dd/mm/yyyy.");
  return d;
}

export async function addFreeEntry(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);
  const title = str(formData.get("title"));
  const content = str(formData.get("content"));
  if (!title && !content) throw new Error("יש להזין כותרת או תוכן.");
  const entry = await prisma.evalEntry.create({
    data: { personId, kind: "FREE", title: title || "רשומה", content: content || null, eventDate: eventDateFrom(formData) },
  });
  await attachIfPresent(entry.id, personId, formData);
  await logActivity({ action: "eval.add", description: `הוסיף חוות דעת עבור ${(await prisma.person.findUnique({ where: { id: personId }, select: { fullName: true } }))?.fullName ?? personId}`, subjectType: "person", subjectId: personId });
  done(personId);
}

/**
 * An ad-hoc interview summary: subject, when it happened, an optional file and
 * an optional 1–5 assessment.
 *
 * A score outside the scale is REFUSED, never clamped: turning a stray 7 into
 * "מעל המצופה" would record an assessment of a person that nobody made.
 */
export async function addInterview(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);
  const title = str(formData.get("title"));
  if (!title) throw new Error("יש להזין נושא לראיון.");

  const score = parseScore(str(formData.get("score")));
  if (score === undefined) throw new Error("דירוג לא תקין — יש לבחור ערך בין 1 ל-5, או להשאיר ריק.");

  const entry = await prisma.evalEntry.create({
    data: {
      personId,
      kind: "INTERVIEW",
      title,
      content: str(formData.get("content")) || null,
      eventDate: eventDateFrom(formData),
      score,
    },
  });
  await attachIfPresent(entry.id, personId, formData);
  await logActivity({
    action: "eval.interview",
    description: `הוסיף סיכום ראיון עבור ${(await prisma.person.findUnique({ where: { id: personId }, select: { fullName: true } }))?.fullName ?? personId}`,
    subjectType: "person",
    subjectId: personId,
  });
  done(personId);
}

/** Fill a structured slot for a recurring occurrence (satisfies the gap). */
export async function fillSlot(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);
  const recurringEventId = str(formData.get("recurringEventId"));
  const occurrenceOffset = Number(str(formData.get("occurrenceOffset")));
  if (!recurringEventId || !Number.isFinite(occurrenceOffset)) throw new Error("סלוט לא תקין.");

  const rec = await prisma.recurringEvent.findUnique({ where: { id: recurringEventId } });
  if (!rec) throw new Error("אירוע מחזורי לא נמצא.");
  // A slot's event date is ITS occurrence month on the person's own timeline —
  // not today. The slot already knows when it was due; dating it "now" would
  // scatter the plan's occurrences across whenever someone got round to typing.
  const anchor = await prisma.person.findUniqueOrThrow({ where: { id: personId }, select: { placementDate: true } });

  const content = str(formData.get("content"));
  // the rating exists only where the event asks for it; a posted score for an
  // unflagged event is ignored, not an error — a stale form must not block a fill
  let score: number | null = null;
  if (rec.withScore) {
    const parsed = parseScore(str(formData.get("score")));
    if (parsed === undefined) throw new Error("דירוג לא תקין — יש לבחור ערך בין 1 ל-5, או להשאיר ריק.");
    score = parsed;
  }
  const entry = await prisma.evalEntry.upsert({
    where: {
      personId_recurringEventId_occurrenceOffset: { personId, recurringEventId, occurrenceOffset },
    },
    create: {
      personId,
      recurringEventId,
      occurrenceOffset,
      eventDate: addMonths(anchor.placementDate, occurrenceOffset),
      title: `${rec.label} · גיוס +${formatYearsMonths(occurrenceOffset)}`,
      content: content || null,
      score,
    },
    update: { content: content || null, score },
  });
  await attachIfPresent(entry.id, personId, formData);
  await logActivity({ action: "eval.fill", description: `מילא מופע חוות דעת עבור ${(await prisma.person.findUnique({ where: { id: personId }, select: { fullName: true } }))?.fullName ?? personId}`, subjectType: "person", subjectId: personId });
  done(personId);
}

export async function deleteEntry(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);
  const id = str(formData.get("entryId"));
  await prisma.evalEntry.deleteMany({ where: { id, personId } }); // attachments cascade
  await logActivity({ action: "eval.delete", description: `מחק חוות דעת עבור ${(await prisma.person.findUnique({ where: { id: personId }, select: { fullName: true } }))?.fullName ?? personId}`, subjectType: "person", subjectId: personId });
  done(personId);
}
