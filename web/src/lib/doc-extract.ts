import path from "path";
import { writeFile } from "fs/promises";
import { extractTextFromFile } from "@/lib/doc-text";

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
