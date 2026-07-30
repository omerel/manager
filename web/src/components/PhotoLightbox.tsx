"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { X } from "lucide-react";

/** Person photo that opens enlarged in a centered overlay when clicked. */
export function PhotoLightbox({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="להגדלה" className="shrink-0">
        <img src={src} alt={alt} className={`${className ?? ""} cursor-zoom-in transition hover:brightness-95`} />
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute end-6 top-6 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
            title="סגור"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[85vw] rounded-xl border-4 border-white/80 object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
