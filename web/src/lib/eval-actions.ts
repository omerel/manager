"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEditForPerson } from "@/lib/authz";
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
export async function addFreeEntry(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);
  const title = str(formData.get("title"));
  const content = str(formData.get("content"));
  if (!title && !content) throw new Error("יש להזין כותרת או תוכן.");
  const entry = await prisma.evalEntry.create({
    data: { personId, title: title || "רשומה", content: content || null },
  });
  await attachIfPresent(entry.id, personId, formData);
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
  if (!rec) throw new Error("אירוע כרוני לא נמצא.");

  const content = str(formData.get("content"));
  const entry = await prisma.evalEntry.upsert({
    where: {
      personId_recurringEventId_occurrenceOffset: { personId, recurringEventId, occurrenceOffset },
    },
    create: {
      personId,
      recurringEventId,
      occurrenceOffset,
      title: `${rec.label} · גיוס +${occurrenceOffset} חודשים`,
      content: content || null,
    },
    update: { content: content || null },
  });
  await attachIfPresent(entry.id, personId, formData);
  done(personId);
}

export async function deleteEntry(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);
  const id = str(formData.get("entryId"));
  await prisma.evalEntry.deleteMany({ where: { id, personId } }); // attachments cascade
  done(personId);
}
