import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getLogoPath, getSystemName, getLoginLink, getInterviewFormat, DEFAULT_SYSTEM_NAME, DEFAULT_LOGIN_LINK_TEXT } from "@/lib/branding";
import { uploadLogo, resetLogo, updateSystemName, updateLoginLink, uploadInterviewFormat, clearInterviewFormat } from "@/lib/branding-actions";
import { importBundle } from "@/lib/portability-actions";
import { AppLogo, LogoMark } from "@/components/Logo";
import { FileDrop } from "@/components/FileDrop";
import { ActionForm } from "@/components/ActionForm";
import { Palette, DatabaseBackup, Download, Upload, ExternalLink, Eraser, Paperclip } from "lucide-react";
import { DevWipe } from "@/components/DevWipe";
import { dataWipeEnabled } from "@/lib/dev-wipe";

export default async function SystemSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; importError?: string }>;
}) {
  const { imported, importError } = await searchParams;
  const me = await getSessionUser();
  if (me.role !== "ADMIN") redirect("/");
  const logoPath = await getLogoPath();
  const customLogo = !!logoPath;
  const systemName = await getSystemName();
  const loginLink = await getLoginLink();
  const interviewFormat = await getInterviewFormat();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">הגדרות מערכת</h1>
          <p className="mt-1 text-muted">מיתוג ותצורה כלל-מערכתית (אדמין בלבד).</p>
        </div>
        <Link href="/system/activity" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-stone-50">
          יומן פעילות
        </Link>
      </div>

      <section className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Palette className="h-5 w-5 text-brand-600" aria-hidden />
          מיתוג המערכת
        </h2>

        <ActionForm action={updateSystemName} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col">
            <label htmlFor="systemName" className="mb-1 text-sm text-muted">
              שם המערכת (מוצג בסרגל, בהתחברות, בכותרת הדפדפן ובדוחות)
            </label>
            <input
              id="systemName"
              name="systemName"
              defaultValue={systemName}
              placeholder={DEFAULT_SYSTEM_NAME}
              className="w-72 rounded-md border border-border px-3 py-1.5 text-sm"
            />
          </div>
          <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            שמור שם
          </button>
          <p className="w-full text-xs text-muted">{`ניקוי השדה מחזיר לברירת המחדל "${DEFAULT_SYSTEM_NAME}".`}</p>
        </ActionForm>
        <div className="flex items-center gap-4">
          <AppLogo logoPath={logoPath} size={48} />
          <div className="text-sm text-muted">
            {customLogo ? "לוגו מותאם-אישית פעיל." : "הלוגו המובנה (ברירת מחדל) פעיל."}
            <br />
            הלוגו מוצג בסרגל העליון ובמסך ההתחברות.
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <ActionForm action={uploadLogo} className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col">
              <label htmlFor="logo" className="mb-1 text-sm text-muted">העלאת לוגו (PNG / SVG / JPG)</label>
              <FileDrop name="logo" accept="image/*" required label="גרור/י לוגו לכאן (PNG / SVG / JPG)" className="min-w-72" />
            </div>
            <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              החלף לוגו
            </button>
          </ActionForm>
          {customLogo && (
            <ActionForm action={resetLogo}>
              <button className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-stone-50">
                חזרה ללוגו המובנה
              </button>
            </ActionForm>
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

      {/* Login-page environment link */}
      <section className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ExternalLink className="h-5 w-5 text-brand-600" aria-hidden />
          קישור באתר ההתחברות
        </h2>
        <p className="text-sm text-muted">
          כרטיס מתחת לטופס ההתחברות המפנה לאתר אחר — למשל לסביבת הפיתוח. הכרטיס מוצג רק כשהוא
          במצב ״הצג״ וגם הוזנה כתובת.
        </p>
        <ActionForm action={updateLoginLink} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label htmlFor="loginLinkText" className="mb-1 text-sm text-muted">טקסט הכרטיס</label>
            <input
              id="loginLinkText"
              name="loginLinkText"
              defaultValue={loginLink.text}
              placeholder={DEFAULT_LOGIN_LINK_TEXT}
              className="w-64 rounded-md border border-border px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="loginLinkUrl" className="mb-1 text-sm text-muted">כתובת היעד (http/https)</label>
            <input
              id="loginLinkUrl"
              name="loginLinkUrl"
              dir="ltr"
              defaultValue={loginLink.url ?? ""}
              placeholder="https://dev.example.com"
              className="w-80 rounded-md border border-border px-3 py-1.5 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 py-1.5 text-sm">
            <input type="checkbox" name="loginLinkEnabled" defaultChecked={loginLink.enabled} className="accent-brand-600" />
            הצג במסך ההתחברות
          </label>
          <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            שמור קישור
          </button>
          <p className="w-full text-xs text-muted">{`ניקוי הטקסט מחזיר לברירת המחדל "${DEFAULT_LOGIN_LINK_TEXT}"; ניקוי הכתובת מסתיר את הכרטיס.`}</p>
        </ActionForm>
      </section>

      {/* the house format an interview summary is written on */}
      <section className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Paperclip className="h-5 w-5 text-brand-600" aria-hidden />
          פורמט סיכום ראיון
        </h2>
        <p className="text-sm text-muted">
          קובץ אחד לכל המערכת — הפורמט שעליו נכתב סיכום ראיון. הוא יוצע להורדה לצד טופס הראיון בכרטיס כל עובד.
          העלאת קובץ חדש מחליפה את הקודם.
        </p>
        {interviewFormat ? (
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/interview-format"
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-stone-50"
            >
              <Paperclip className="h-4 w-4 text-brand-600" aria-hidden />
              {interviewFormat.name}
            </a>
            <ActionForm action={clearInterviewFormat}>
              <button className="text-sm text-red-600 hover:underline">הסר פורמט</button>
            </ActionForm>
          </div>
        ) : (
          <p className="text-sm text-muted">לא הוגדר פורמט — לא יוצעה הורדה בכרטיסים.</p>
        )}
        <ActionForm action={uploadInterviewFormat} className="flex flex-wrap items-end gap-2">
          <FileDrop name="format" required label="גרור/י קובץ פורמט" className="min-w-64" />
          <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            {interviewFormat ? "החלף פורמט" : "העלה פורמט"}
          </button>
        </ActionForm>
      </section>

      {dataWipeEnabled() && (
        <section className="space-y-4 rounded-xl border border-red-200 bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Eraser className="h-5 w-5 text-red-600" aria-hidden />
            מחיקת נתונים (סביבת פיתוח)
          </h2>
          <p className="text-sm text-muted">
            מחיקה לפי סוג נתונים — לניקוי סביבת הפיתוח בין ניסויים. משתמשים, הרשאות, עץ הארגון,
            ההגדרות ויומן הפעילות לעולם אינם נמחקים כאן. הכלי אינו קיים בסביבת ייצור.
          </p>
          <DevWipe />
        </section>
      )}

      {/* Backup & data portability */}
      <section className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <DatabaseBackup className="h-5 w-5 text-brand-600" aria-hidden />
          גיבוי ונתונים
        </h2>

        {imported && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {imported} — ייתכן שתידרש התחברות מחדש עם משתמשי הגיבוי.
          </div>
        )}
        {importError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{importError}</div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border/70 p-4">
            <h3 className="flex items-center gap-1.5 font-medium">
              <Download className="h-4 w-4 text-brand-600" aria-hidden /> ייצוא
            </h3>
            <p className="text-sm text-muted">
              <b>גיבוי מלא</b> — ZIP עם כל הנתונים והקבצים (כולל משתמשים וסיסמאות מוצפנות — לשמור במקום מאובטח).
              <br />
              <b>תצורה בלבד</b> — JSON של המבנה: מסגרות, שדות כרטיס, תבניות תכניות ומשתמשים, בלי אנשים.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/system/export?scope=full"
                className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                הורד גיבוי מלא (ZIP)
              </a>
              <a
                href="/system/export?scope=config"
                className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-stone-50"
              >
                הורד תצורה (JSON)
              </a>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/40 p-4">
            <h3 className="flex items-center gap-1.5 font-medium text-red-800">
              <Upload className="h-4 w-4" aria-hidden /> ייבוא / שחזור
            </h3>
            <p className="text-sm text-red-800/80">
              שחזור מגיבוי מלא <b>מוחק את כל הנתונים הקיימים</b> ומחליף אותם בתוכן הגיבוי.
              ייבוא תצורה מותר רק כשאין אנשים במרשם.
            </p>
            <ActionForm action={importBundle} className="space-y-2">
              <FileDrop name="bundle" required accept=".zip,.json" label="גרור/י חבילת גיבוי לכאן (ZIP / JSON)" />
              <label className="flex items-start gap-2 text-sm text-red-800">
                <input type="checkbox" name="confirm" className="mt-0.5" />
                אני מבין/ה שהייבוא ימחק את הנתונים הקיימים ויחליף אותם בתוכן הקובץ.
              </label>
              <button className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700">
                ייבא ושחזר
              </button>
            </ActionForm>
          </div>
        </div>
      </section>
    </div>
  );
}
