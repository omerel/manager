"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileCheck2 } from "lucide-react";

/**
 * Drag-and-drop file field that still behaves like a plain <input type=file>
 * inside a server-action form: the dropped file is written onto the hidden
 * input, so the form submits exactly as before.
 */
export function FileDrop({
  name,
  accept,
  required,
  label = "גרור/י קובץ לכאן או לחץ/י לבחירה",
  className,
}: {
  name: string;
  accept?: string;
  required?: boolean;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (!file || !inputRef.current) return;
        const dt = new DataTransfer();
        dt.items.add(file);
        inputRef.current.files = dt.files;
        setFileName(file.name);
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
        className="hidden"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
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
    </div>
  );
}
