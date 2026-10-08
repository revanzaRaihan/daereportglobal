# White-Labeling & Brand Customization Guide

This guide details how to customize and rebrand **Daely Report Studio** to match your institution or tutoring center's visual identity in minutes.

---

## 1. Changing the Institution / Application Name

The application name is configured centrally via environment variables and resolved in [`src/lib/branding.ts`](file:///c:/Users/user/.gemini/antigravity/scratch/dreport-studio-next/src/lib/branding.ts).

### Steps:
1. Open `.env.local` (or configure Environment Variables on your hosting provider such as Vercel).
2. Set the application name:
   ```env
   NEXT_PUBLIC_APP_NAME="Your Institution Name"
   ```
3. This value is automatically applied to:
   - Dashboard headers and sidebars
   - Browser tab titles (HTML title tags & OpenGraph metadata)
   - Login and account activation screens
   - Notification emails for parent feedback
   - Public parent portal footer (`/p/[slug]`)

---

## 2. Replacing Application Logo & Favicon

All primary brand graphic assets reside in the `public/` directory.

### Asset Locations:
1. **Primary Logo:**
   - File: `public/logo.png`
   - Recommended format: Transparent PNG, square 1:1 aspect ratio, minimum 512x512 pixels.
   - Displayed across: Sidebar, Login screen, Mobile navigation bar, and browser favicon.

2. **Favicon / Shortcut Icon:**
   - Configured in `src/app/layout.tsx` pointing to `public/logo.png` or `public/favicon.ico`.

### How to Replace:
Simply overwrite `public/logo.png` with your organization's logo using the same filename, then perform a hard refresh in your browser (`Ctrl + F5` or `Cmd + Shift + R`).

---

## 3. Configuring Notification Email for Parent Feedback

When parents submit questions or evaluation feedback via the student portal, notifications can be routed to your institution's central administration email.

### Configuration in `.env.local`:
```env
NEXT_PUBLIC_BRANCH_ADMIN_EMAIL="admin@yourinstitution.com"
```

If left unconfigured, the system defaults to `admin@school.com`.

---

## 4. Selecting and Configuring the AI Engine

The platform supports multiple AI backends for report generation:

1. **Google Gemini (Recommended)**:
   ```env
   AI_PROVIDER=gemini
   AI_MODEL=gemini-2.5-flash
   AI_API_KEY=AIzaSy...
   ```
2. **Groq Cloud (High-speed Alternative)**:
   ```env
   AI_PROVIDER=groq
   AI_MODEL=llama-3.1-8b-instant
   AI_API_KEY=gsk_...
   ```

*Note: Administrators can update the AI model and API key dynamically through the **Settings** menu without redeploying code. Every configuration change is safely tracked in the Audit Trail.*
