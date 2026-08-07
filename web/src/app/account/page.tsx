import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { changeMyPassword } from "@/lib/auth-actions";
import { Lock } from "lucide-react";

const inputCls = "rounded-md border border-border px-3 py-1.5 text-sm";

import { roleLabel } from "@/lib/role-labels";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; changed?: string }> }) {
  const { error, changed } = await searchParams;
  const me = await getSessionUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">החשבון שלי</h1>
        <p className="mt-1 text-muted">
          {user.name} · {user.email} {user.username ? `· ${user.username}` : ""} ·{" "}
          {roleLabel(user.role)}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          הסיסמה הנוכחית שגויה.
        </div>
      )}
      {changed && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          הסיסמה עודכנה בהצלחה.
        </div>
      )}

      <section className="space-y-3 rounded-xl border border-border/70 bg-card shadow-sm p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-900"><Lock className="h-5 w-5 text-brand-600" aria-hidden /> החלפת סיסמה</h2>
        <form action={changeMyPassword} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col">
            <label htmlFor="current" className="mb-1 text-sm text-muted">סיסמה נוכחית</label>
            <input id="current" name="current" type="password" required autoComplete="current-password" className={inputCls} />
          </div>
          <div className="flex flex-col">
            <label htmlFor="next" className="mb-1 text-sm text-muted">סיסמה חדשה (6+ תווים)</label>
            <input id="next" name="next" type="password" required minLength={6} autoComplete="new-password" className={inputCls} />
          </div>
          <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            עדכן סיסמה
          </button>
        </form>
      </section>
    </div>
  );
}
