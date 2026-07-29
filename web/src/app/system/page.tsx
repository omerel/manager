import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getLogoPath } from "@/lib/branding";
import { uploadLogo, resetLogo } from "@/lib/branding-actions";
import { AppLogo, LogoMark } from "@/components/Logo";
import { Palette } from "lucide-react";

export default async function SystemSettingsPage() {
  const me = await getSessionUser();
  if (me.role !== "ADMIN") redirect("/");
  const customLogo = !!(await getLogoPath());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">הגדרות מערכת</h1>
        <p className="mt-1 text-muted">מיתוג ותצורה כלל-מערכתית (אדמין בלבד).</p>
      </div>

      <section className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Palette className="h-5 w-5 text-brand-600" aria-hidden />
          לוגו המערכת
        </h2>
        <div className="flex items-center gap-4">
          <AppLogo customLogo={customLogo} size={48} />
          <div className="text-sm text-muted">
            {customLogo ? "לוגו מותאם-אישית פעיל." : "הלוגו המובנה (ברירת מחדל) פעיל."}
            <br />
            הלוגו מוצג בסרגל העליון ובמסך ההתחברות.
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <form action={uploadLogo} className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col">
              <label htmlFor="logo" className="mb-1 text-sm text-muted">העלאת לוגו (PNG / SVG / JPG)</label>
              <input id="logo" name="logo" type="file" accept="image/*" required className="text-sm" />
            </div>
            <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              החלף לוגו
            </button>
          </form>
          {customLogo && (
            <form action={resetLogo}>
              <button className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-stone-50">
                חזרה ללוגו המובנה
              </button>
            </form>
          )}
        </div>

        {!customLogo && (
          <div className="flex items-center gap-3 rounded-lg bg-brand-50 px-4 py-3">
            <LogoMark size={40} />
            <p className="text-sm text-brand-900">
              ״צמיחה״ — סימן הבית של המערכת: שלוש מדרגות עולות ועלה צומח.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
