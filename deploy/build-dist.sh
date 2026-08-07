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

# Destroys the database so the next start rebuilds it from scratch. Shipped
# because an upgrade can leave data the new schema no longer fits; run by hand,
# never automatically.
cat > "$DIST/reset-db.sh" <<'RESET'
#!/bin/bash
# מוחק את כל הטבלאות במסד הנתונים. ההפעלה הבאה של המערכת תיצור סכימה חדשה
# וריקה, ותיצור מחדש את משתמש האדמין מתוך app.env.
#
# מה נמחק: אנשים, מסגרות, תכניות, חוות דעת, משתמשים, הגדרות — הכול.
# מה לא נמחק: קבצים שהועלו (ה-volume). הם יישארו בלי שאיש מצביע עליהם.
#
# להורדת גיבוי מלא לפני כן: הגדרות מערכת ← גיבוי ונתונים ← הורד גיבוי מלא.
#
# החיבור למסד: DATABASE_URL מתוך app.env — אותו משתנה ואותו ערך שהאפליקציה
# עצמה משתמשת בהם. אין כאן הגדרה נפרדת שאפשר לשכוח לעדכן.
#
# ב-OpenShift אין docker. שם מריצים את אותו סקריפט בתוך הפוד:
#   oc rsh <pod> node /app/docker/reset-db.mjs        ← מציג מה יימחק
#   oc rsh <pod> node /app/docker/reset-db.mjs --yes  ← מוחק
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE="${1:-app.env}"
IMAGE="${IMAGE:-manager-app:latest}"
[ -f "$ENV_FILE" ] || { echo "לא נמצא קובץ סביבה: $ENV_FILE"; exit 1; }

# --entrypoint node חובה: ל-image יש ENTRYPOINT שמריץ מיגרציות ומעלה את השרת,
# ובלעדיו הארגומנטים כאן היו נבלעים והסקריפט לא היה רץ כלל.
run() { docker run --rm --env-file "$ENV_FILE" ${DOCKER_NETWORK:+--network "$DOCKER_NETWORK"} \
          --entrypoint node "$IMAGE" docker/reset-db.mjs "$@"; }

echo "מסד הנתונים לפי DATABASE_URL שב-$ENV_FILE יימחק כולו."
run || true

read -r -p 'להמשיך? הקלד/י בדיוק MERGE-NOTHING-DELETE-ALL כדי לאשר: ' answer
[ "$answer" = "MERGE-NOTHING-DELETE-ALL" ] || { echo "בוטל — לא נמחק דבר."; exit 1; }

run --yes
echo "בוצע. הפעל/י מחדש את הקונטיינר כדי לבנות סכימה נקייה."
RESET
chmod +x "$DIST/reset-db.sh"

cat > "$DIST/README.md" <<'GUIDE'
# התקנת מערכת ניהול קריירה — רשת סגורה

חבילה זו מכילה את כל מה שנדרש להרצת המערכת ללא אינטרנט.

## תוכן החבילה
- `manager-app.tar.gz.part-*` — דימוי הדוקר, מכווץ ומפוצל לחלקים של 100MB
- `load-image.sh` — איחוד החלקים וטעינת הדימוי לדוקר
- `app.env.example` — תבנית משתני הסביבה
- `docker-compose.example.yml` — דוגמת הרצה
- `reset-db.sh` — מחיקת כל מסד הנתונים (ידני בלבד, ראו למטה)
- **שימו לב:** שליחת מייל דורשת החלפת `docker/emailer.py` — ראו ״נקודות תפעול״
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
- `UPLOADS_DIR` — תיקיית הקבצים שהועלו. ברירת המחדל `/app/uploads`; חייב
  להיות volume/PVC קבוע (ראו ״נקודות תפעול״)

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
- **קבצים שהועלו (תמונות, מסמכים, לוגו) חייבים volume קבוע** — ב-OpenShift זה
  PVC שמותקן על הנתיב. מה שנכתב לדיסק של הפוד עצמו נמחק כשהפוד מתחלף או קורס,
  וזו הסיבה שתמונות ״נעלמות״ אחרי קריסה. ברירת המחדל בדימוי היא
  `UPLOADS_DIR=/app/uploads` — התקינו PVC שם, או בנתיב אחר ואז הצביעו עליו
  ב-`UPLOADS_DIR`.
- מופע יחיד בלבד (לא לשכפל pods).
- **שליחת דוחות במייל דורשת התאמה אצלכם.** `docker/emailer.py` שבדימוי הוא
  תחליף (stub) שמדפיס ואינו שולח — סביבת היעד אמורה להחליף אותו בסקריפט
  ששולח בפועל. החוזה כולו הוא זה:
  ```
  python3 docker/emailer.py --title "<נושא>" --body "<markdown>" --to "<כתובת>"
  ```
  הסקריפט מדפיס `1` (נשלח) או `0` (נכשל) כ**שורה האחרונה שאינה ריקה** ב-stdout,
  ויוצא רגיל. אפשר להדפיס לפניה כמה שרוצים — רק השורה האחרונה נקראת.
  **קוד היציאה אינו ההכרעה.** בלי החלפה, הפקת דוח תעבוד והשליחה תיכשל בשקט
  יחסי — המשתמש יראה שהשליחה נכשלה, בלי רמז לסיבה.
- **`reset-db.sh` מוחק את כל מסד הנתונים** (ב-OpenShift, שבו אין docker:
  `oc rsh <pod> node /app/docker/reset-db.mjs --yes`) ומאפשר לבנות אותו מחדש נקי בהפעלה
  הבאה. הוא מדפיס תחילה את כל הטבלאות ומספר השורות בכל אחת, ודורש אישור מפורש.
  הקבצים שהועלו אינם נמחקים. כדאי להוריד גיבוי מלא לפני (הגדרות מערכת ←
  גיבוי ונתונים).
- סוכן ה-AI: ה-claude CLI כלול בדימוי ויורש את סביבת הקונטיינר —
  אם נדרשת אצלכם קונפיגורציה להפעלתו, ספקו אותה לפוד כרגיל.
GUIDE

echo ""
echo "=== dist ready ==="
ls -lh "$DIST"
echo ""
echo "total: $(du -sh "$DIST" | cut -f1) · carry the dist/ folder to the air-gapped network"
