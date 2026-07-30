## 1. Implementation

- [x] 1.1 branding.ts: getSystemName/setSystemName (AppSetting key `systemName`, default "Manager", empty reverts)
- [x] 1.2 System-settings page: name field + save action in the branding section (admin-only)
- [x] 1.3 Render sites: Header (both states), login page, layout generateMetadata (tab title), PDF meta line

## 2. Verification

- [x] 2.1 Rename via UI → nav, login, tab title, PDF footer all show the new name; clear → back to "Manager"
- [x] 2.2 Manager cannot change it (admin-only guard)
