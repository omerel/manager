import { NextResponse } from "next/server";
import { getGuestPersonOrNull } from "@/lib/guest-session";
import { getPersonFull } from "@/lib/person-view";
import { renderPlanPdf } from "@/lib/plan-pdf";

/**
 * The guest's own plan as a PDF.
 *
 * Takes no id, for the same reason `/me` takes none: the person comes from the
 * signed cookie, so there is no parameter to alter and nothing to compare a
 * parameter against. A route that accepted an id and then checked it would be
 * one forgotten check away from handing out someone else's plan; this one has
 * no check to forget.
 */
export async function GET() {
  const guest = await getGuestPersonOrNull();
  if (!guest) return new NextResponse("unauthorized", { status: 401 });

  const person = await getPersonFull(guest.id);
  if (!person) return new NextResponse("not found", { status: 404 });

  return renderPlanPdf(person);
}
