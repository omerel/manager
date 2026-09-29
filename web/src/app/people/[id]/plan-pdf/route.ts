import { NextResponse } from "next/server";
import { getSessionUserOrNull } from "@/lib/session";
import { computeVisibility } from "@/lib/access";
import { getPersonFull } from "@/lib/person-view";
import { renderPlanPdf } from "@/lib/plan-pdf";

/**
 * The person's own career plan as a PDF — the same drawing their card shows,
 * carrying THEIR colours, which is what separates it from the plan page's
 * export of the bare track.
 *
 * Visibility is decided here, from the requester's own scope: the URL carries a
 * person id, so a link cannot become a way to read someone else's plan. The
 * drawing itself is `renderPlanPdf`, shared with the guest's own export, which
 * answers the same question for a requester who has no visibility at all.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserOrNull();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const person = await getPersonFull(id);
  if (!person) return new NextResponse("not found", { status: 404 });

  const visibility = await computeVisibility(user);
  const maySee = person.teamId ? visibility.nodeIds.has(person.teamId) : visibility.isAdmin;
  if (!maySee) return new NextResponse("not found", { status: 404 });

  return renderPlanPdf(person);
}
