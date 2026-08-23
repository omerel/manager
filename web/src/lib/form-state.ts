"use server";

import { withState, type ActionState } from "@/lib/action-state";

/**
 * The single bridge every ActionForm submits through.
 *
 * `action` arrives as a serialized server-function reference (ActionForm binds
 * it client-side), so one registered action serves all ~90 forms — no registry
 * of wrapped variants. No authority changes hands here: the client could call
 * the referenced action directly; running it through the bridge only changes
 * how its refusal travels back.
 */
export async function runWithState(
  action: (formData: FormData) => void | Promise<unknown>,
  prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withState(async (fd) => action(fd))(prev, formData);
}
