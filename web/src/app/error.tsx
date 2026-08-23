"use client";

import { AlertTriangle, Home, RotateCcw } from "lucide-react";

/**
 * The last-resort boundary. Ordinary refusals of user actions never land here
 * — they travel as state and surface as toasts (see ActionForm). If this page
 * is showing, something escaped that path; production redacts thrown messages,
 * so this page offers recovery and deliberately does not pretend to know why.
 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-md rounded-xl border border-border/70 bg-card p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
        <h1 className="mt-4 text-xl font-bold text-brand-900">משהו השתבש</h1>
        <p className="mt-2 text-sm text-muted">
          אירעה שגיאה בלתי-צפויה. אפשר לנסות שוב, או לחזור לעמוד הראשי — הנתונים שלך לא נפגעו.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            נסה שוב
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-stone-50"
          >
            <Home className="h-4 w-4" aria-hidden />
            לעמוד הראשי
          </a>
        </div>
      </div>
    </div>
  );
}
