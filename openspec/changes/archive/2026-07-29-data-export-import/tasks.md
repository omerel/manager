## 1. Export

- [x] 1.1 Install adm-zip; define the bundle format (version/scope/exportedAt) and the explicit model inventory per scope
- [x] 1.2 Portability service: dump tables in dependency order (config + full), collect referenced upload files
- [x] 1.3 Download routes: /system/export?scope=full (ZIP with files) and ?scope=config (JSON), admin-only
- [x] 1.4 "גיבוי ונתונים" section on /system with the two export buttons

## 2. Import / restore

- [x] 2.1 Bundle validation: format, version, scope — reject cleanly before touching data
- [x] 2.2 Full restore: wipe + insert in one transaction (original ids), then restore files
- [x] 2.3 Config import guarded to an empty people registry
- [x] 2.4 Import form (file + required destructive-confirmation checkbox) + result banner with counts; re-login warning

## 3. Verification

- [x] 3.1 Round-trip test: export full → wipe DB → import → table counts and spot-checks match; files restored
- [x] 3.2 Guards: manager denied; import without confirmation does nothing; invalid/wrong-version bundle rejected; config import into live system rejected
- [x] 3.3 Failed-import atomicity: corrupt bundle mid-data leaves existing data unchanged
