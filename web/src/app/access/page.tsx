import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { computeVisibility, visibilityFrom } from "@/lib/access";
import { KIND_LABEL } from "@/lib/org";
import { pathResolver } from "@/lib/commander";
import { ROLE_LABEL, roleLabel } from "@/lib/role-labels";
import { LevelBadge } from "@/components/OrgTree";
import { ActionForm } from "@/components/ActionForm";
import { createUser, addGrant, removeGrant, deleteUser, updateUserProfile } from "@/lib/access-actions";
import { adminResetPassword } from "@/lib/auth-actions";

const inputCls = "rounded-md border border-border px-3 py-1.5 text-sm";

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ q?: string; edit?: string }> }) {
  const { q, edit: editUserId } = await searchParams;
  const query = (q ?? "").trim();

  const [me, allUsers, nodes] = await Promise.all([
    getSessionUser(),
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { grants: { include: { node: true } }, commandsNode: true },
    }),
    prisma.orgNode.findMany(),
  ]);

  const isAdmin = me.role === "ADMIN";

  // Managers see only users under their hierarchy (a grant within their subtree).
  let users = allUsers;
  if (!isAdmin) {
    const visibility = await computeVisibility(me);
    users = allUsers.filter((u) => u.role !== "ADMIN" && u.grants.some((g) => visibility.nodeIds.has(g.nodeId)));
  }
  if (query) {
    const ql = query.toLowerCase();
    users = users.filter((u) => u.name.toLowerCase().includes(ql) || u.email.toLowerCase().includes(ql));
  }

  const nodeOptions = nodes
    .map((n) => ({ id: n.id, label: `${KIND_LABEL[n.kind]}: ${n.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label, "he"));

  // Commands are labelled by full path, not by name: names repeat between
  // branches, and picking the wrong "צוות תשתיות" fails silently — it breaks
  // nothing, it just records the wrong person as responsible.
  const resolvePath = pathResolver(nodes);
  const frameworkOptions = nodes
    .map((n) => ({ id: n.id, path: resolvePath(n.id) }))
    .sort((a, b) => a.path.localeCompare(b.path, "he"));

  // What each user may be given to command: only what they can already see.
  // The very same function the server action checks against — the chooser must
  // not offer a value the action would refuse.
  const visibleTo = (u: (typeof allUsers)[number]) =>
    visibilityFrom(nodes, { id: u.id, name: u.name, role: u.role, grants: u.grants }).nodeIds;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">משתמשים והרשאות</h1>
        <p className="mt-1 text-muted">
          {isAdmin
            ? "הרשאה = צומת בעץ + רמה (עריכה/צפייה). ניהול המשתמשים בסמכות האדמין בלבד."
            : "מוצגים המשתמשים שתחת ניהולך ההיררכי בלבד."}
        </p>
      </div>

      <form method="get" action="/access" className="flex flex-wrap items-center gap-2">
        <input type="search" name="q" defaultValue={query} placeholder="חיפוש לפי שם או אימייל…" className={`w-64 bg-card ${inputCls}`} />
        <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">חפש</button>
        {query && (
          <Link href="/access" className="rounded-md px-3 py-1.5 text-sm text-muted hover:underline">
            נקה
          </Link>
        )}
      </form>

      {isAdmin && (
        <ActionForm action={createUser} className="flex flex-wrap items-end gap-2 rounded-xl border border-border/70 bg-card shadow-sm p-4">
          <Field name="name" label="שם" placeholder="שם מלא" />
          <Field name="email" label="אימייל" placeholder="name@example.com" type="email" />
          <Field name="password" label="סיסמה" placeholder="סיסמה" type="password" />
          <div className="flex flex-col">
            <label htmlFor="role" className="mb-1 text-sm text-muted">
              תפקיד
            </label>
            <select id="role" name="role" defaultValue="MANAGER" className={inputCls}>
              <option value="MANAGER">{ROLE_LABEL.MANAGER}</option>
              <option value="HR">{ROLE_LABEL.HR}</option>
              <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label htmlFor="grantNodeId" className="mb-1 text-sm text-muted">
              הרשאה ראשונה
            </label>
            <select id="grantNodeId" name="grantNodeId" defaultValue="" className={inputCls}>
              <option value="">ללא</option>
              {frameworkOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.path}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label htmlFor="grantLevel" className="mb-1 text-sm text-muted">
              רמה
            </label>
            <select id="grantLevel" name="grantLevel" defaultValue="VIEW" className={inputCls}>
              <option value="VIEW">צפייה</option>
              <option value="EDIT">עריכה</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label htmlFor="commandsNodeId" className="mb-1 text-sm text-muted">
              מסגרת בפיקוד
            </label>
            <select id="commandsNodeId" name="commandsNodeId" defaultValue="" className={inputCls}>
              <option value="">ללא</option>
              {frameworkOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.path}
                </option>
              ))}
            </select>
          </div>
          <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            צור משתמש
          </button>
          <p className="w-full text-xs text-muted">
            שם המשתמש (username) ייגזר אוטומטית מהאימייל עד ה־@. הפיקוד אינו מקנה גישה אלא מותנה בה: המסגרת שבפיקוד חייבת
            להיות בתוך ההרשאה הראשונה (אדמין רואה את כל העץ). לכל מסגרת מפקד אחד לכל היותר.
          </p>
        </ActionForm>
      )}

      {users.length === 0 ? (
        <p className="text-muted">{query ? `לא נמצאו משתמשים התואמים ל״${query}״.` : "אין משתמשים להצגה."}</p>
      ) : (
        <div className="space-y-4">
          {users.map((u) => (
            <div key={u.id} className="rounded-xl border border-border/70 bg-card shadow-sm p-4">
              {isAdmin && editUserId === u.id ? (
                <div className="rounded-md bg-brand-50/60 p-3">
                  <ActionForm action={updateUserProfile} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <div className="flex flex-col">
                      <label className="mb-1 text-xs text-muted">שם</label>
                      <input name="name" defaultValue={u.name} required className={inputCls} />
                    </div>
                    <div className="flex flex-col">
                      <label className="mb-1 text-xs text-muted">אימייל</label>
                      <input name="email" type="email" defaultValue={u.email} required className={inputCls} />
                    </div>
                    <div className="flex flex-col">
                      <label className="mb-1 text-xs text-muted">מסגרת בפיקוד</label>
                      {/* Only frameworks this user can already see — plus whatever
                          they hold today, so a command that drifted out of reach
                          can still be read and cleared here. */}
                      <select name="commandsNodeId" defaultValue={u.commandsNodeId ?? ""} className={inputCls}>
                        <option value="">ללא</option>
                        {frameworkOptions
                          .filter((n) => visibleTo(u).has(n.id) || n.id === u.commandsNodeId)
                          .map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.path}
                            </option>
                          ))}
                      </select>
                    </div>
                    <button className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                      שמור
                    </button>
                    <Link href="/access" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">
                      ביטול
                    </Link>
                  </ActionForm>
                  <p className="mt-1 text-xs text-muted">
                    שם המשתמש להתחברות ({u.username ?? "—"}) נשאר קבוע גם אם האימייל משתנה. ברשימת הפיקוד מוצגות רק מסגרות
                    שהמשתמש רואה — כדי לפקד על מסגרת אחרת, יש לתת עליה הרשאה תחילה.
                  </p>
                </div>
              ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold">{u.name}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      u.role === "ADMIN"
                        ? "bg-brand-100 text-brand-800"
                        : u.role === "HR"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {roleLabel(u.role)}
                  </span>
                  <span className="text-xs text-muted">{u.email}</span>
                  {u.username && <span className="text-xs text-muted">· {u.username}</span>}
                  {u.commandsNode && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                      מפקד: {resolvePath(u.commandsNodeId)}
                    </span>
                  )}
                  {/* Appointment requires access, but a framework MOVED in the tree
                      can drift out of the commander's reach afterwards. That is
                      shown, never silently repaired. */}
                  {u.commandsNodeId && !visibleTo(u).has(u.commandsNodeId) && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                      אין הרשאה על המסגרת שבפיקודו
                    </span>
                  )}
                  {isAdmin && (
                    <Link href={`/access?edit=${u.id}`} className="text-xs text-brand-700 hover:underline">
                      ערוך
                    </Link>
                  )}
                </div>
                {isAdmin && (
                  <span className="flex items-center gap-3">
                    <ActionForm action={adminResetPassword} className="flex items-center gap-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <input
                        name="password"
                        type="password"
                        minLength={6}
                        required
                        placeholder="סיסמה חדשה"
                        autoComplete="new-password"
                        className="w-28 rounded border border-border px-2 py-1 text-xs"
                      />
                      <button className="text-xs text-brand-700 hover:underline">אפס סיסמה</button>
                    </ActionForm>
                    {u.id !== me.id && (
                      <ActionForm action={deleteUser}>
                        <input type="hidden" name="userId" value={u.id} />
                        <button className="text-xs text-red-600 hover:underline">מחק משתמש</button>
                      </ActionForm>
                    )}
                  </span>
                )}
              </div>
              )}

              <div className="mt-3">
                {u.role === "ADMIN" ? (
                  <p className="text-sm text-muted">גישה מלאה לכל העץ הארגוני (ללא צורך בהענקות).</p>
                ) : (
                  <>
                    {u.grants.length === 0 ? (
                      <p className="text-sm text-muted">ללא הענקות.</p>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        {u.grants.map((g) => (
                          <li key={g.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm">
                            <span className="text-xs text-muted">{KIND_LABEL[g.node.kind]}</span>
                            <span>{g.node.name}</span>
                            <LevelBadge level={g.level} />
                            {isAdmin && (
                              <ActionForm action={removeGrant} className="inline">
                                <input type="hidden" name="grantId" value={g.id} />
                                <button className="text-xs text-red-600 hover:underline">הסר</button>
                              </ActionForm>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {isAdmin && (
                      <ActionForm action={addGrant} className="mt-3 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <div className="flex flex-col">
                          <label className="mb-1 text-sm text-muted">מסגרת</label>
                          <select name="nodeId" className={inputCls}>
                            {nodeOptions.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col">
                          <label className="mb-1 text-sm text-muted">רמה</label>
                          <select name="level" defaultValue="VIEW" className={inputCls}>
                            <option value="VIEW">צפייה</option>
                            <option value="EDIT">עריכה</option>
                          </select>
                        </div>
                        <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">הענק</button>
                      </ActionForm>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted">הערה: דף החוקים של כל משתמש הוא פרטי — אינו נראה כאן ולא למי שמעליו בעץ.</p>
    </div>
  );
}

function Field({ name, label, placeholder, type = "text" }: { name: string; label: string; placeholder?: string; type?: string }) {
  return (
    <div className="flex flex-col">
      <label htmlFor={name} className="mb-1 text-sm text-muted">
        {label}
      </label>
      <input id={name} name={name} type={type} placeholder={placeholder} className={inputCls} />
    </div>
  );
}
