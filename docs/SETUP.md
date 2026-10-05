# הגדרות: ענן (Firebase) ו-Google Maps

האפליקציה עובדת **מיד, בלי שום הגדרה**, במצב מקומי:
- החשבונות והנתונים נשמרים בדפדפן של כל מכשיר בנפרד.
- המפה חינמית (OpenStreetMap).

שני החיבורים הבאים אופציונליים, ואפשר להוסיף כל אחד מהם מתי שרוצים.

| חיבור | מה הוא נותן | עלות |
|---|---|---|
| **Firebase** | חשבונות משותפים, טיול משותף עם קוד הזמנה, סנכרון בזמן אמת בין טלפונים, עבודה בלי אינטרנט | חינם (תוכנית Spark), **בלי כרטיס אשראי** |
| **Google Maps** | מפת Google, חיפוש והמלצות מ-Google עם תמונות, דירוגים ושעות פתיחה | דורש חשבון חיוב. יש מכסה חינמית חודשית שבדרך כלל מספיקה לטיול זוגי |

---

## 1. Firebase: חשבונות וטיול משותף (חינם)

1. נכנסים ל-https://console.firebase.google.com ולוחצים **Create a project**. Google Analytics לא נחוץ.
2. **Authentication** → **Get started** → **Sign-in method** → מפעילים את **Email/Password**.
   המשתמשים יירשמו רק עם שם משתמש וסיסמה. האפליקציה ממירה את שם המשתמש לכתובת פנימית, ולא נשלחים מיילים או קודי אימות.
3. **Firestore Database** → **Create database**:
   - אזור: `asia-northeast1 (Tokyo)`.
   - מצב: **Production mode**.
4. בלשונית **Rules** של Firestore מדביקים את כל התוכן של הקובץ [`firestore.rules`](../firestore.rules) ולוחצים **Publish**.
5. **Project settings** (גלגל השיניים) → **Your apps** → מוסיפים אפליקציית Web (`</>`). מעתיקים את ששת הערכים מתוך `firebaseConfig`.
6. **Authentication** → **Settings** → **Authorized domains** → מוסיפים את הדומיין של האתר, למשל `sadokobi-bot.github.io`.

## 2. Google Maps: מפה, חיפוש והמלצות של Google

1. ב-https://console.cloud.google.com בוחרים את אותו פרויקט של Firebase ומחברים חשבון חיוב (**Billing**).
   מומלץ להגדיר **Budget alert** של כמה דולרים כדי לקבל התראה.
2. **APIs & Services → Library** → מפעילים את **Maps JavaScript API** ואת **Places API (New)**.
3. **APIs & Services → Credentials → Create credentials → API key**. אחר כך עורכים את המפתח:
   - **Application restrictions**: בוחרים *Websites* ומוסיפים:
     - `https://sadokobi-bot.github.io/*`
     - `http://localhost:5173/*`
   - **API restrictions**: מגבילים לשני ה-APIs שהפעלתם.
4. **Google Maps Platform → Map Management → Create Map ID**, מסוג JavaScript + Vector.

## 3. הכנסת הערכים

**לאתר שבגיטהב:** במאגר בגיטהב נכנסים ל-**Settings → Secrets and variables → Actions → New repository secret**, ומוסיפים כל ערך בשם שלו:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_GOOGLE_MAPS_API_KEY
VITE_GOOGLE_MAP_ID
```

אחר כך נכנסים ל-**Actions → Deploy to GitHub Pages → Run workflow**, ותוך כדקה האתר מתעדכן.

**לפיתוח במחשב:** מעתיקים את `.env.example` ל-`.env.local` וממלאים את אותם ערכים.

> שימו לב: חשבונות שנוצרו במצב המקומי לא עוברים לענן. אחרי חיבור Firebase כל אחד נרשם מחדש פעם אחת.
