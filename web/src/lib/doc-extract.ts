import path from "path";
import { writeFile } from "fs/promises";

/**
 * Normalize an uploaded document into something the agent's Read tool handles:
 * - PDF / plain text / markdown / csv → copied as-is
 * - docx → text via mammoth · xlsx → CSV per sheet via SheetJS
 * Returns the filename written inside `dir`.
 */
export async function materializeDocument(dir: string, file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name).toLowerCase();

  if (ext === ".docx" || ext === ".doc") {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer: buf });
    const name = "document.txt";
    await writeFile(path.join(dir, name), value, "utf8");
    return name;
  }

  if (ext === ".xlsx" || ext === ".xls") {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer" });
    const parts: string[] = [];
    for (const sheetName of wb.SheetNames) {
      parts.push(`# גיליון: ${sheetName}`, XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]), "");
    }
    const name = "document.txt";
    await writeFile(path.join(dir, name), parts.join("\n"), "utf8");
    return name;
  }

  // pdf / txt / md / csv — pass through under a predictable name
  const safeExt = [".pdf", ".txt", ".md", ".csv"].includes(ext) ? ext : ".txt";
  const name = `document${safeExt}`;
  await writeFile(path.join(dir, name), buf);
  return name;
}
