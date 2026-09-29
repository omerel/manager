"use client";

import { useState } from "react";
import { KeyRound, UserRound } from "lucide-react";

/**
 * The two ways in, side by side.
 *
 * Both panels are rendered and one is hidden, rather than swapped in and out:
 * each contains a form that posts to a server action, and unmounting a form
 * mid-submit is how a pending action loses the fields it was sent with. The
 * hidden panel is also `inert`, so nothing inside it is focusable or
 * submittable while it is out of view.
 */
export function LoginTabs({
  user,
  guest,
  startOnGuest,
}: {
  user: React.ReactNode;
  guest: React.ReactNode;
  /** a refused guest attempt comes back to the guest panel, not to the user one */
  startOnGuest?: boolean;
}) {
  const [tab, setTab] = useState<"user" | "guest">(startOnGuest ? "guest" : "user");

  const cls = (mine: "user" | "guest") =>
    `flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
      tab === mine ? "bg-white text-brand-900 shadow-sm" : "text-muted hover:text-brand-900"
    }`;

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-1 rounded-lg bg-stone-100 p-1">
        <button role="tab" type="button" aria-selected={tab === "user"} onClick={() => setTab("user")} className={cls("user")}>
          <KeyRound className="h-4 w-4" aria-hidden />
          כניסת משתמש
        </button>
        <button role="tab" type="button" aria-selected={tab === "guest"} onClick={() => setTab("guest")} className={cls("guest")}>
          <UserRound className="h-4 w-4" aria-hidden />
          כניסת אורח
        </button>
      </div>

      <div hidden={tab !== "user"} inert={tab !== "user" ? true : undefined}>{user}</div>
      <div hidden={tab !== "guest"} inert={tab !== "guest" ? true : undefined}>{guest}</div>
    </div>
  );
}
