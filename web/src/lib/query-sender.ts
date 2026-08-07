import type { QuerySenderKind } from "@/generated/prisma/client";

/** What a lateral sender is called. One string, because it appears in two surfaces. */
export const STAFF_SENDER_TITLE = "משא״ן";

export function staffSenderLabel(name: string | null): string {
  return `${STAFF_SENDER_TITLE} · ${name ?? "—"}`;
}

/**
 * The from-line for a query, branching on who sent it.
 *
 * Client-safe (type-only prisma import) and shared on purpose: the recipient's
 * card on the page and the body of the notification mail both go through here.
 * If they diverged, a commander would read one thing on screen and another in
 * their inbox about the same question — and the divergence a lateral sender
 * would produce is the worst kind, because a request that reads as coming from
 * the framework above it arrives with the weight of an order.
 *
 * `frameworkPath` is only ever used for a FRAMEWORK query. A STAFF query's
 * `senderNodeId` records the scope the request was made under, never its
 * sender, and must not reach the screen.
 */
export function senderLabel(
  query: { senderKind: QuerySenderKind; author?: { name: string } | null },
  frameworkPath: string,
): string {
  return query.senderKind === "STAFF" ? staffSenderLabel(query.author?.name ?? null) : frameworkPath;
}
