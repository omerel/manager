import { redirect } from "next/navigation";
import { getSessionUserOrNull } from "@/lib/session";
import { getLogoPath, getSystemName, getLoginLink } from "@/lib/branding";
import { ExternalLink } from "lucide-react";
import { login, guestLogin } from "@/lib/auth-actions";
import { getGuestPersonOrNull, GUEST_REFUSAL } from "@/lib/guest-session";
import { ActionForm } from "@/components/ActionForm";
import { PendingButton } from "@/components/PendingButton";
import { AppLogo } from "@/components/Logo";
import { DateField } from "@/components/DateField";
import { LoginTabs } from "@/components/LoginTabs";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; guest?: string }> }) {
  const { error, guest } = await searchParams;
  // already signed in → straight to the dashboard
  if (await getSessionUserOrNull()) redirect("/");
  // already admitted as a guest → straight to their own record
  if (await getGuestPersonOrNull()) redirect("/me");
  const [logoPath, systemName, loginLink] = await Promise.all([getLogoPath(), getSystemName(), getLoginLink()]);

  return (
    <div className="mx-auto mt-16 w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center text-center">
        <AppLogo logoPath={logoPath} size={64} />
        <h1 className="mt-3 text-2xl font-bold text-brand-900">{systemName}</h1>
        <p className="mt-1 text-muted">התחברות למערכת</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          שם משתמש או סיסמה שגויים.
        </div>
      )}

      {guest === "0" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {GUEST_REFUSAL}
        </div>
      )}

      <LoginTabs
        startOnGuest={guest === "0"}
        user={
      <ActionForm action={login} className="space-y-4 rounded-xl border border-border/70 bg-card shadow-sm p-6">
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
      </ActionForm>
        }
        guest={
          <ActionForm action={guestLogin} className="space-y-4 rounded-xl border border-border/70 bg-card shadow-sm p-6">
            <p className="text-sm text-muted">
              אם משויכת לך תכנית קריירה, ניתן לצפות בכרטיס האישי שלך — לקריאה בלבד.
            </p>
            <DateField name="birthDate" label="תאריך לידה" required />
            <div className="flex flex-col">
              <label htmlFor="tz" className="mb-1 text-sm text-muted">
                תעודת זהות
              </label>
              <input
                id="tz"
                name="tz"
                required
                inputMode="numeric"
                autoComplete="off"
                className="rounded-md border border-border px-3 py-2 text-sm"
              />
            </div>
            <PendingButton
              pendingLabel="בודק…"
              className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              הצג את הכרטיס שלי
            </PendingButton>
          </ActionForm>
        }
      />

      {loginLink.enabled && loginLink.url && (
        <div className="rounded-xl border border-border/70 bg-card p-4 text-center shadow-sm">
          <p className="text-sm text-muted">{loginLink.text}</p>
          <a
            href={loginLink.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-brand-700 hover:bg-stone-50"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            מעבר לאתר
          </a>
        </div>
      )}
    </div>
  );
}
