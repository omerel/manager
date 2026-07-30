## Context

Small follow-up to ui-facelift: the `AppSetting` key-value table was designed for exactly this (its design noted the system name as the natural next key). The logo flow (get/set helpers + settings section + revalidate layout) is the template to mirror.

## Goals / Non-Goals

**Goals:** one `systemName` setting, default "Manager", rendered in nav / login / tab title / PDF footer; editable next to the logo controls.
**Non-Goals:** per-page titles, localization of the name, changing agent prompt wording (domain description, not branding).

## Decisions

**D1 — `AppSetting` key `systemName`; empty ⇒ default "Manager".**
`getSystemName()` returns the stored value or the constant default; `setSystemName("")` deletes the row (revert semantics identical to the logo). No migration.

**D2 — Browser-tab title via `generateMetadata`.**
`layout.tsx` switches from a static `metadata` export to `generateMetadata()` reading `getSystemName()` — evaluated per request, so a rename shows without rebuild.

**D3 — Single fetch per render where already fetching.**
Header and login already call `getLogoPath()`; fetch the name alongside (two tiny queries — fine at this scale; no caching layer).

## Risks / Trade-offs

- The PDF meta line and tab title become dynamic — trivial queries on already-dynamic routes.

## Migration Plan

Helpers → settings UI → render sites → verify (rename via UI, check all four surfaces, revert).

## Open Questions

None.
