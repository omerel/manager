import { redirect } from "next/navigation";
import { getSessionUserOrNull } from "@/lib/session";
import { getLogoPath } from "@/lib/branding";
import { login } from "@/lib/auth-actions";
import { PendingButton } from "@/components/PendingButton";
import { AppLogo } from "@/components/Logo";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  // already signed in → straight to the dashboard
  if (await getSessionUserOrNull()) redirect("/");
  const customLogo = !!(await getLogoPath());

  return (
    <div className="mx-auto mt-16 w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center text-center">
        <AppLogo customLogo={customLogo} size={64} />
        <h1 className="mt-3 text-2xl font-bold text-brand-900">ניהול קריירה</h1>
        <p className="mt-1 text-muted">התחברות למערכת</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          שם משתמש או סיסמה שגויים.
        </div>
      )}

      <form action={login} className="space-y-4 rounded-xl border border-border/70 bg-card shadow-sm p-6">
        <div className="flex flex-col">
          <label htmlFor="identifier" className="mb-1 text-sm text-muted">
            שם משתמש או אימייל
          </label>
          <input
            id="identifier"
            name="identifier"
            required
            autoComplete="username"
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="password" className="mb-1 text-sm text-muted">
            סיסמה
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <PendingButton
          pendingLabel="מתחבר…"
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          התחבר
        </PendingButton>
      </form>
    </div>
  );
}
