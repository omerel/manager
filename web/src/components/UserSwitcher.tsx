"use client";

type UserOption = { id: string; label: string };

/**
 * Active-user switch as a native GET form → /switch?uid=... (sets cookie, redirects).
 * Works without client JS and over proxied origins; onChange auto-submits when JS is on.
 */
export function UserSwitcher({ users, currentId }: { users: UserOption[]; currentId: string }) {
  return (
    <form method="get" action="/switch" className="flex items-center gap-2">
      <label htmlFor="uid" className="text-sm text-muted">
        משתמש פעיל
      </label>
      <select
        id="uid"
        name="uid"
        defaultValue={currentId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-border bg-card px-2 py-1 text-sm"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-md border border-border px-2 py-1 text-sm hover:bg-slate-50">
        החלף
      </button>
    </form>
  );
}
