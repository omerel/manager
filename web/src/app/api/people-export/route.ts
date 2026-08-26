import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getSessionUserOrNull } from "@/lib/session";
import { computeVisibility } from "@/lib/access";
import { logActivity } from "@/lib/activity-log";
import { buildPathResolver } from "@/lib/people";
import { getFieldDefs } from "@/lib/person-schema";
import { buildPeopleSheet, chooseColumns, exportColumns, type ExportPerson } from "@/lib/people-export";

/**
 * The registry as an .xlsx workbook.
 *
 * WHO is exported is decided here, from the requester's own visibility — the
 * request carries only WHICH columns. And it is deliberately the whole visible
 * registry, not the table's on-screen filter: a file sent onward must not be
 * quietly missing people because someone left a filter set.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUserOrNull();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const form = await req.formData();
  const keys = form.getAll("column").map(String);

  const visibility = await computeVisibility(user);
  const teamIds = [...visibility.nodeIds];
  // the same clause getVisiblePeople uses: the Admin also sees the unassigned
  const where = visibility.isAdmin
    ? { OR: [{ teamId: { in: teamIds } }, { teamId: null }] }
    : { teamId: { in: teamIds } };

  const [rows, defs, resolvePath] = await Promise.all([
    prisma.person.findMany({
      where,
      orderBy: { fullName: "asc" }, // the order the list itself uses
      include: { assignedPlan: { select: { name: true } }, fieldValues: { select: { fieldDefId: true, value: true } } },
    }),
    getFieldDefs(),
    buildPathResolver(),
  ]);

  const columns = chooseColumns(exportColumns(defs), keys);
  if (columns.length === 0) return new NextResponse("לא נבחר אף שדה לייצוא.", { status: 400 });

  const people: ExportPerson[] = rows.map((p) => ({
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: p.fullName,
    birthDate: p.birthDate,
    recruitmentDate: p.recruitmentDate,
    placementDate: p.placementDate,
    status: p.status,
    endOfServiceDate: p.endOfServiceDate,
    orgPath: resolvePath(p.teamId),
    planName: p.assignedPlan?.name ?? null,
    fieldValues: p.fieldValues,
  }));

  const sheet = XLSX.utils.aoa_to_sheet(buildPeopleSheet(people, columns));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "אנשים");
  const body: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  await logActivity({
    action: "people.export",
    description: `ייצא את מרשם האנשים לאקסל: ${people.length} אנשים, ${columns.length} שדות`,
    subjectType: "person",
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`אנשים-${stamp}.xlsx`)}`,
    },
  });
}
