# Firebase Auth Setup with Nodemailer

This guide covers configuring Firebase authentication with email verification codes sent via Nodemailer (using Gmail app password or another SMTP provider).

---

## 1. Firebase Console Setup

### 1.1 Create/Select Project
- Go to [Firebase Console](https://console.firebase.google.com/)
- Create a new project or select existing one

### 1.2 Enable Authentication
- **Authentication** → **Sign-in method** → **Email/Password** → Enable

### 1.3 Get Web Config
- **Project Settings** (gear) → **General** → **Your apps** → Add Web app (or copy config)
- Copy: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`

### 1.4 Get Service Account (for API routes)
- **Project Settings** → **Service accounts** → **Generate new private key**
- Copy the entire JSON and keep it secure (you'll add to `.env.local` as a stringified value)

### 1.5 Firestore Rules
Add rules for `verification_codes` and ensure `users` are writable by authenticated users. Example:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /verification_codes/{docId} {
      allow read, write: if true;  // API routes use Admin SDK (bypasses rules)
    }
    match /watchlist/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /history/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 2. Gmail App Password (for Nodemailer)

### 2.1 Enable 2-Step Verification
- [Google Account](https://myaccount.google.com/) → **Security**
- Turn on **2-Step Verification** (required for app passwords)

### 2.2 Create App Password
- **Security** → **2-Step Verification** → **App passwords**
- Select app: **Mail**
- Select device: **Other** → enter "Anime Village" or your app name
- Click **Generate** → copy the 16-character password (e.g. `abcd efgh ijkl mnop`)

---

## 3. Environment Variables

Add these to `.env.local` (create if it doesn't exist):

### 3.1 Firebase (Client)
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 3.2 Firebase Admin (Server - API routes)
```env
# Paste the entire service account JSON as a single line (escape quotes if needed)
# Or use a file path with GOOGLE_APPLICATION_CREDENTIALS
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

### 3.3 Nodemailer / SMTP (for verification emails)

**Option A: Gmail with App Password**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_APP_PASSWORD=abcdefghijklmnop
SMTP_FROM=your-email@gmail.com
```

**Option B: Other SMTP (Outlook, Yahoo, custom)**
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_APP_PASSWORD=your-app-password
SMTP_FROM=your-email@outlook.com
```

### 3.4 Optional
```env
NEXT_PUBLIC_SITE_NAME=Anime Village
```

---

## 4. Firestore Indexes

No composite indexes are required for the basic auth flow. The `verification_codes` collection uses document ID lookups. The `users` query uses a simple `email` equality filter.

---

## 5. Install Dependencies

```bash
pnpm install
```

This installs `nodemailer` and `@types/nodemailer` (already in package.json).

---

## 6. Auth Flow Summary

| Step | Action |
|------|--------|
| 1 | User fills Register form (email, password, display name) |
| 2 | Firebase creates user → API sends 6-digit code via Nodemailer |
| 3 | User receives email with code |
| 4 | User enters code → API verifies → marks `emailVerified: true` in Firestore |
| 5 | Modal closes, user is signed in |

**Login** and **Forgot password** use Firebase’s built-in flows (no custom verification codes).

---

## 7. Checklist

- [ ] Firebase Email/Password auth enabled
- [ ] `.env.local` has all `NEXT_PUBLIC_FIREBASE_*` variables
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` set (or `GOOGLE_APPLICATION_CREDENTIALS` path)
- [ ] `SMTP_HOST`, `SMTP_USER`, `SMTP_APP_PASSWORD` set
- [ ] Gmail 2-Step Verification enabled (if using Gmail)
- [ ] App password created
- [ ] Firestore rules updated

---

## 8. Troubleshooting

| Issue | Fix |
|-------|-----|
| "Authentication is not configured" | Check `NEXT_PUBLIC_FIREBASE_*` env vars |
| "Email service is not configured" | Check `SMTP_*` env vars |
| "Database not configured" | Check `FIREBASE_SERVICE_ACCOUNT_JSON` |
| Gmail "Less secure app" / login blocked | Use App Password, not normal password |
| Emails go to spam | Use a custom domain or check SPF/DKIM for your SMTP |
