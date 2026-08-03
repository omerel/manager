import path from "path";
import { writeFile } from "fs/promises";
import { extractTextFromFile } from "@/lib/doc-text";
import { prisma } from "@/lib/prisma";

/**
 * Two-step by design: staging the upload is instant and happens in the request;
 * extraction (which may fall back to OCR and take minutes) runs inside the
 * background job. The agent only ever reads the resulting text file, so a
 * non-multimodal model works and no script execution is ever needed.
 */

/** Write the raw upload into `dir`; returns its absolute path and original name. */
export async function stageUpload(dir: string, file: File): Promise<{ abs: string; filename: string }> {
  const filename = path.basename(file.name) || "upload";
  const abs = path.join(dir, `raw-${filename}`);
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return { abs, filename };
}

/** Extract text from a staged upload into `document.txt`. Null when unreadable. */
export async function materializeDocument(
  dir: string,
  staged: { abs: string; filename: string },
): Promise<{ name: string; method: string; note?: string } | null> {
  const { text, method, note } = await extractTextFromFile(staged.abs, staged.filename);
  if (!text.trim()) return null;

  const name = "document.txt";
  const header = [
    `# ${staged.filename}`,
    `# חולץ בשיטת: ${method === "ocr" ? "OCR (מסמך סרוק)" : "טקסט מקורי"}`,
    "",
  ].join("\n");
  await writeFile(path.join(dir, name), header + text, "utf8");
  return { name, method, note };
}

/**
 * The card schema handed to the agent (core fields + admin-defined fields).
 * Shared by the single-document flows and bulk intake, so a field added to the
 * card is extracted everywhere at once.
 */
export async function extractionFields() {
  const defs = await prisma.personFieldDef.findMany({ orderBy: { order: "asc" } });
  return [
    { key: "firstName", label: "שם פרטי", type: "טקסט" },
    { key: "lastName", label: "שם משפחה", type: "טקסט" },
    { key: "birthDate", label: "תאריך לידה", type: "תאריך" },
    { key: "recruitmentDate", label: "תאריך גיוס", type: "תאריך" },
    { key: "placementDate", label: "תאריך הצבה ביחידה", type: "תאריך" },
    { key: "endOfServiceDate", label: "תאריך סיום שירות (תת״ש)", type: "תאריך" },
    ...defs.map((d) => ({
      key: `field:${d.id}`,
      label: d.label,
      type: d.type === "DATE" ? "תאריך" : d.type === "NUMBER" ? "מספר" : "טקסט",
      options: d.type === "ENUM" ? d.options : undefined,
    })),
  ];
}
