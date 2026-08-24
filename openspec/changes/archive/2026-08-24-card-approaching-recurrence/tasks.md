# Tasks: card-approaching-recurrence

- [x] 1. `EvaluationsSection.tsx`: derive `approaching` per slot via `dueLevel` from `@/lib/gaps`; add the 🟡 amber row state («· מתקרב») between waived and plain-future in the precedence chain.
- [x] 2. Verify: `npx tsc --noEmit`; new `web/scripts/verify-card-approaching.ts` (engine says APPROACHING ⇔ card marks the same occurrence; waived stays ⊘) passing twice; `verify-recurring-display` still green; `npm run build` clean.
