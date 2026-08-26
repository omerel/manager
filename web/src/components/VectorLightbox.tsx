"use client";

import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";

/**
 * The career plan, enlargeable.
 *
 * In its column the drawing is about half its natural width, which is fine for
 * "how am I doing" and too small to read a label. Clicking opens it filling the
 * screen — the same gesture, keys and dismissal as the photo lightbox, because
 * a second enlarging idiom in one card would be one too many.
 *
 * The SVG is passed as markup and rendered twice, inline and enlarged: it is
 * built on the server from the person's own plan and carries no interactivity
 * of its own, so a second copy costs nothing but markup.
 */
export function VectorLightbox({ svg }: { svg: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    // the page behind must not scroll while the overlay is up
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="להגדלה"
        className="group relative block w-full cursor-zoom-in rounded-md"
      >
        <div className="max-h-[70vh] overflow-y-auto" dangerouslySetInnerHTML={{ __html: svg }} />
        <span className="pointer-events-none absolute end-2 top-2 flex items-center gap-1 rounded-md bg-white/85 px-2 py-1 text-xs text-brand-800 shadow-sm transition group-hover:bg-white">
          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          להגדלה
        </span>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute end-6 top-6 z-10 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
            title="סגור"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          {/* a tall plan still scrolls; the click-through guard keeps the
              overlay open while the reader scrolls or selects text */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-xl border-4 border-white/80 bg-white p-2 shadow-2xl"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      )}
    </>
  );
}
