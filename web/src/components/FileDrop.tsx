"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileCheck2 } from "lucide-react";

/**
 * Drag-and-drop file field that still behaves like a plain <input type=file>
 * inside a server-action form: the dropped file is written onto the input, so
 * the form submits exactly as before.
 *
 * The visible area is a <label> WRAPPING the input, not a div with a
 * programmatic `.click()`. That is load-bearing twice over:
 *
 *  - Opening the chooser is native browser behavior — it works with zero
 *    JavaScript, so a page whose hydration broke (or a browser that refuses
 *    synthetic clicks on invisible file inputs, as Safari has) still opens it.
 *  - The input is visually hidden with `sr-only`, not `display:none`. A
 *    `required` input under display:none cannot be focused, so submitting the
 *    form empty died silently with "not focusable" instead of showing the
 *    browser's validation message.
 */
export function FileDrop({
  name,
  accept,
  required,
  multiple,
  label = "גרור/י קובץ לכאן או לחץ/י לבחירה",
  className,
}: {
  name: string;
  accept?: string;
  required?: boolean;
  /** accept several files at once; the display becomes a name list */
  multiple?: boolean;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  return (
    <label
      // BOTH dragenter and dragover must be cancelled for the element to be a
      // valid drop target. That is the spec, not a nicety: Chrome accepts the
      // drop with dragover alone, Safari silently refuses it — dragging just
      // does nothing, with no error anywhere.
      onDragEnter={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy"; // show the copy cursor, not the refuse one
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const dropped = multiple ? [...e.dataTransfer.files] : [...e.dataTransfer.files].slice(0, 1);
        if (dropped.length === 0 || !inputRef.current) return;
        const dt = new DataTransfer();
        for (const f of dropped) dt.items.add(f);
        inputRef.current.files = dt.files;
        setFileName(dropped.map((f) => f.name).join(", "));
      }}
      className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed px-3 py-2.5 text-sm transition-colors ${
        over ? "border-brand-500 bg-brand-50" : fileName ? "border-brand-200 bg-brand-50/50" : "border-border hover:bg-stone-50"
      } ${className ?? ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        required={required}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const names = [...(e.target.files ?? [])].map((f) => f.name);
          setFileName(names.length ? names.join(", ") : null);
        }}
      />
      {fileName ? (
        <>
          <FileCheck2 className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          <span className="truncate font-medium text-brand-900">{fileName}</span>
          <span className="text-xs text-muted">· להחלפה לחץ/י כאן</span>
        </>
      ) : (
        <>
          <UploadCloud className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <span className="text-muted">{label}</span>
        </>
      )}
    </label>
  );
}
