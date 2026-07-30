import { execFile } from "child_process";
import { readFile, writeFile, mkdtemp, rm, readdir } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

/**
 * Server-side document → text. The agent NEVER receives raw binaries: a
 * text-only model cannot read them, and reading them would otherwise require
 * granting the agent script execution (see design D1–D3).
 *
 * Tiers: native extraction first (instant, exact), OCR only as a fallback for
 * scans and images (seconds per page, approximate).
 */

export type ExtractMethod = "native" | "ocr" | "none";
export type ExtractResult = { text: string; method: ExtractMethod; note?: string };

// Below this many characters we assume native extraction found nothing real
// (a scanned PDF typically yields zero or a few stray glyphs).
const MIN_MEANINGFUL_CHARS = 40;
const OCR_TIMEOUT_MS = 120_000;
const OCR_MAX_PAGES = 10;
const OCR_LANGS = "heb+eng";

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"];
const PLAIN_EXTS = [".txt", ".md", ".csv", ".json", ".log", ".tsv"];

/** pdftotext wraps RTL runs in bidi control marks; strip them for a clean prompt. */
function stripBidiMarks(s: string): string {
  return s.replace(/[‎‏‪-‮⁦-⁩]/g, "");
}

function run(cmd: string, args: string[], timeout = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, { timeout, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stdout) reject(new Error((stderr || err.message).slice(0, 500)));
      else resolve(stdout);
    });
    child.stdin?.end();
  });
}

/** Turn a spawn failure into something an operator can act on. */
function ocrError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/ENOENT/.test(msg)) {
    return new Error("OCR אינו זמין בסביבה זו (חסרות החבילות tesseract-ocr / poppler-utils).");
  }
  return new Error(msg);
}

async function ocrImage(absPath: string): Promise<string> {
  // tesseract writes plain text to stdout with the "stdout" output target
  try {
    return (await run("tesseract", [absPath, "stdout", "-l", OCR_LANGS], OCR_TIMEOUT_MS)).trim();
  } catch (e) {
    throw ocrError(e);
  }
}

/** Rasterize the first pages of a PDF and OCR them. */
async function ocrPdf(absPath: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "ocr-"));
  try {
    try {
      await run("pdftoppm", ["-r", "150", "-png", "-f", "1", "-l", String(OCR_MAX_PAGES), absPath, path.join(dir, "p")], OCR_TIMEOUT_MS);
    } catch (e) {
      throw ocrError(e);
    }
    const pages = (await readdir(dir)).filter((f) => f.endsWith(".png")).sort();
    const out: string[] = [];
    for (const pageFile of pages) {
      out.push(await ocrImage(path.join(dir, pageFile)));
    }
    return out.join("\n\n").trim();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Extract text from a file on disk. Never throws — reports method "none" instead. */
export async function extractTextFromFile(absPath: string, filename = absPath): Promise<ExtractResult> {
  const ext = path.extname(filename).toLowerCase();

  try {
    // --- images: OCR is the only option ---
    if (IMAGE_EXTS.includes(ext)) {
      const text = await ocrImage(absPath);
      return text.length > 0
        ? { text, method: "ocr" }
        : { text: "", method: "none", note: "לא זוהה טקסט בתמונה." };
    }

    // --- PDF: native text, OCR fallback for scans ---
    if (ext === ".pdf") {
      let native = "";
      try {
        native = stripBidiMarks(await run("pdftotext", ["-layout", "-enc", "UTF-8", absPath, "-"])).trim();
      } catch {
        /* fall through to OCR */
      }
      if (native.length >= MIN_MEANINGFUL_CHARS) return { text: native, method: "native" };
      try {
        const ocr = await ocrPdf(absPath);
        if (ocr.length > 0) return { text: ocr, method: "ocr", note: "המסמך נסרק (OCR)." };
      } catch (e) {
        return {
          text: native,
          method: native ? "native" : "none",
          note: `ה-PDF אינו מכיל שכבת טקסט (סרוק/מצולם), ו-OCR נכשל: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
      return { text: native, method: native ? "native" : "none", note: "לא נמצא טקסט קריא ב-PDF." };
    }

    // --- Word ---
    if (ext === ".docx" || ext === ".doc") {
      const mammoth = (await import("mammoth")).default;
      const { value } = await mammoth.extractRawText({ buffer: await readFile(absPath) });
      const text = value.trim();
      return text ? { text, method: "native" } : { text: "", method: "none", note: "המסמך ריק." };
    }

    // --- Excel: one CSV block per sheet ---
    if (ext === ".xlsx" || ext === ".xls") {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await readFile(absPath), { type: "buffer" });
      const parts: string[] = [];
      for (const sheetName of wb.SheetNames) {
        parts.push(`# גיליון: ${sheetName}`, XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]), "");
      }
      const text = parts.join("\n").trim();
      return text ? { text, method: "native" } : { text: "", method: "none", note: "הגיליון ריק." };
    }

    // --- plain text ---
    if (PLAIN_EXTS.includes(ext)) {
      return { text: (await readFile(absPath, "utf8")).trim(), method: "native" };
    }

    // --- unknown: accept it if it looks like text ---
    const buf = await readFile(absPath);
    const asText = buf.toString("utf8");
    // control bytes (other than tab/newline/carriage-return) mean binary
    const binaryish = buf.subarray(0, 4000).some((b) => b < 9 || (b > 13 && b < 32));
    return binaryish
      ? { text: "", method: "none", note: `סוג קובץ לא נתמך לחילוץ טקסט (${ext || "ללא סיומת"}).` }
      : { text: asText.trim(), method: "native" };
  } catch (e) {
    return { text: "", method: "none", note: `חילוץ הטקסט נכשל: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Same, for an in-memory upload. */
export async function extractTextFromBuffer(buf: Buffer, filename: string): Promise<ExtractResult> {
  const dir = await mkdtemp(path.join(tmpdir(), "extract-"));
  const abs = path.join(dir, path.basename(filename) || "upload");
  try {
    await writeFile(abs, buf);
    return await extractTextFromFile(abs, filename);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
