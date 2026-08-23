/**
 * The throw→state adapter behind every ActionForm.
 *
 * Server actions in this codebase refuse bad input by THROWING a Hebrew
 * message. A thrown action error unmounts the page into the error boundary,
 * and production redacts the message — the user loses the page, their input,
 * and the reason at once. Wrapping an action with `withState` converts the
 * throw into a returned value that `useActionState` can hand to a toast,
 * while the action itself keeps its throwing contract for every other caller
 * (scripts, other server code).
 *
 * The wrapper is a plain higher-order function with no directive of its own:
 * it must be APPLIED at module scope of a "use server" file (see
 * `form-actions.ts`) so the compiler registers the wrapped export as a server
 * function.
 */

export type ActionState = { error: string } | { done: number } | null;

/**
 * Next signals redirect()/notFound() by throwing errors whose digest carries
 * a NEXT_ prefix. Those are control flow, not failure — swallowing one would
 * silently break every redirect-after-success. Always rethrow them.
 */
function isNextControlFlow(e: unknown): boolean {
  const digest = (e as { digest?: unknown })?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export function withState(fn: (formData: FormData) => Promise<unknown>) {
  return async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
    try {
      await fn(formData);
      return { done: Date.now() };
    } catch (e) {
      if (isNextControlFlow(e)) throw e;
      const message = e instanceof Error && e.message ? e.message : "הפעולה נכשלה. נסה שוב.";
      return { error: message };
    }
  };
}
