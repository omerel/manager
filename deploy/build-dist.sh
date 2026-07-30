#!/bin/bash
# Build the air-gap delivery package into ./dist:
#   manager-app.tar.gz.part-*   the image, gzipped and split into 100MB parts
#   load-image.sh               joins the parts and loads into Docker (Desktop)
#   app.env.example             runtime env template
#   docker-compose.example.yml  run example
#   README.md                   מדריך התקנה (Hebrew install guide)
# Run from anywhere:  sudo deploy/build-dist.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
IMAGE="manager-app:latest"

echo "=== [1/3] building image ==="
docker build -t "$IMAGE" "$ROOT/web"

echo "=== [2/3] saving + compressing + splitting (100MB parts) ==="
rm -rf "$DIST"
mkdir -p "$DIST"
docker save "$IMAGE" | gzip | split -b 100m - "$DIST/manager-app.tar.gz.part-"

echo "=== [3/3] writing loader, env template and guide ==="
cp "$ROOT/deploy/app.env.example" "$DIST/app.env.example"
cp "$ROOT/deploy/docker-compose.example.yml" "$DIST/docker-compose.example.yml"

cat > "$DIST/load-image.sh" <<'LOADER'
#!/bin/bash
# Join the parts and load the image into Docker (works with Docker Desktop).
# docker load auto-detects the gzip — no manual extraction needed.
set -euo pipefail
cd "$(dirname "$0")"
echo "loading manager-app image (this can take a few minutes)…"
cat manager-app.tar.gz.part-* | docker load
echo "done. verify with: docker images manager-app"
LOADER
chmod +x "$DIST/load-image.sh"

cat > "$DIST/README.md" <<'GUIDE'
# התקנת מערכת ניהול קריירה — רשת סגורה

חבילה זו מכילה את כל מה שנדרש להרצת המערכת ללא אינטרנט.

## תוכן החבילה
- `manager-app.tar.gz.part-*` — דימוי הדוקר, מכווץ ומפוצל לחלקים של 100MB
- `load-image.sh` — איחוד החלקים וטעינת הדימוי לדוקר
- `app.env.example` — תבנית משתני הסביבה
- `docker-compose.example.yml` — דוגמת הרצה
- המדריך הזה

## שלב 1 — טעינת הדימוי
העתיקו את כל התיקייה למכונת היעד, ואז:
```bash
bash load-image.sh
```
(או ידנית: `cat manager-app.tar.gz.part-* | docker load`)
ב-Windows עם Docker Desktop — להריץ מתוך Git Bash או WSL.

## שלב 2 — הגדרות
```bash
cp app.env.example app.env
```
וערכו את `app.env`:
- `DATABASE_URL` — החיבור ל-Postgres המנוהל שלכם
- `APP_SECRET` — מחרוזת אקראית חזקה (לשמור יציבה בין שדרוגים!)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — האדמין הראשון (נוצר רק כשה-DB ריק)

## שלב 3 — הרצה
```bash
docker compose -f docker-compose.example.yml up -d
```
או ישירות:
```bash
docker run -d --name manager --env-file app.env \
  -p 3000:3000 -v manager-uploads:/app/uploads \
  --restart unless-stopped manager-app:latest
```
השירות מאזין על 0.0.0.0 — נגיש ממחשבים מרוחקים דרך `http://<כתובת-המכונה>:3000`.

## מה קורה בהפעלה הראשונה
הקונטיינר מאתחל את עצמו: ממתין ל-DB ← מריץ מיגרציות (DB ריק מקבל סכימה
מלאה) ← יוצר את האדמין מה-env ← עולה. **שדרוג גרסה = אותו תהליך בדיוק**
(טוענים דימוי חדש, אותם env ו-volume — המיגרציות החדשות רצות לבד).

## אחרי ההתחברות הראשונה
1. התחברו עם פרטי האדמין מה-env והחליפו סיסמה (החשבון שלי).
2. לאכלוס המערכת: הגדרות מערכת ← גיבוי ונתונים ← ייבוא חבילת תצורה
   או גיבוי מלא ממערכת קיימת.

## נקודות תפעול
- בריאות: `GET /healthz` מחזיר 200 כשהאפליקציה וה-DB תקינים (ל-probes).
- `/app/uploads` חייב volume קבוע (קבצים, תמונות, לוגו).
- מופע יחיד בלבד (לא לשכפל pods).
- סוכן ה-AI: ה-claude CLI כלול בדימוי ויורש את סביבת הקונטיינר —
  אם נדרשת אצלכם קונפיגורציה להפעלתו, ספקו אותה לפוד כרגיל.
GUIDE

echo ""
echo "=== dist ready ==="
ls -lh "$DIST"
echo ""
echo "total: $(du -sh "$DIST" | cut -f1) · carry the dist/ folder to the air-gapped network"
