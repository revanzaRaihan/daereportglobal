# Zero to Production Implementation Guide (Daely Report Studio)

This comprehensive guide is designed for developers and institution administrators implementing, deploying, and configuring **Daely Report Studio** from a clean slate to full production readiness.

---

## 1. System Architecture Overview

Daely Report Studio is built upon **Next.js 16 (App Router & `proxy.ts`)** and the **Supabase Platform**:

```
                               ┌───────────────────────────────────────────────┐
                               │           Daely Report Studio                 │
                               │          (Next.js 16 App Router)              │
                               └───────┬───────────────────────────────┬───────┘
                                       │                               │
                       ┌───────────────▼──────────────┐ ┌──────────────▼──────────────┐
                       │   Supabase Auth & RLS         │ │    Google Gemini AI Engine   │
                       │   (Isolated Multi-Tenant)    │ │    (Automated Report Gen)    │
                       └───────────────┬──────────────┘ └──────────────────────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
    [Branch Admin]             [Teacher / Instructor]     [Parent Portal]
   • Staff Whitelist          • Student Management       • Public Link /p/[slug]
   • AI Configuration         • Generate Draft Reports   • Learning Timeline
   • Safe Deoffboarding       • Feedback Inbox           • Submit Feedback
   • Audit Trail (Logs)       • Voice Dictation Note     • Print / Download
```

### Core Security & Reliability Principles
1. **Whitelist-Governed Staff Onboarding**:
   - Public self-registration is closed to prevent AI token quota abuse.
   - Administrators invite instructors through an internal dashboard.
   - Instructors activate their accounts using single-use secure activation links.
   - Google OAuth callback enforces automated purging of unauthorized external Google accounts.
2. **Tamper-Proof Administrative Privileges (`app_metadata`)**:
   - Administrative roles are anchored in server-governed `app_metadata`, preventing browser-side privilege escalation.
3. **Multi-Tenant Row Level Security (RLS)**:
   - Instructors only access students they manage (`user_id = auth.uid()`).
   - Admins retain supervision and student transfer capabilities.
4. **Safe Deoffboarding Workflow**:
   - Prevents orphan students and data loss when removing instructors.
   - Mandatory reassignment of active students before instructor account deactivation.
5. **Administrative Audit Trail (`public.audit_logs`)**:
   - An immutable, append-only audit log records critical operations (student transfers, AI key changes, teacher removals, and report deletions).
6. **Next.js 16 Proxy Convention (`src/proxy.ts`)**:
   - Replaces deprecated `middleware.ts` with Next.js 16's official `proxy.ts` specification.

---

## 2. Prerequisites

Ensure your development or server environment includes:
1. **Node.js**: Version `20.x` LTS or newer.
2. **Package Manager**: `npm`, `pnpm`, or `yarn`.
3. **Git**: For version control and deployment.
4. **Supabase Account**: Free or Pro tier at [supabase.com](https://supabase.com).
5. **Google AI Studio API Key**: Free tier available at [aistudio.google.com](https://aistudio.google.com).
6. **(Optional) Google Cloud Console**: Required if enabling Google OAuth for staff sign-in.

---

## 3. Step-by-Step Setup Guide

### Step 1: Initialize Supabase Project

1. Log in to [Supabase Dashboard](https://supabase.com/dashboard) and click **"New Project"**.
2. Configure project name, a secure database password, and choose the closest region.
3. Once provisioned, open **Project Settings** (gear icon) -> **API**.
4. Retrieve the following credentials:
   - **Project URL** (e.g. `https://xyzcompany.supabase.co`)
   - **anon / public key**
   - **service_role secret key** *(Keep strictly confidential on server)*

---

### Step 2: Execute Master Database Schema (`schema.sql`)

1. In Supabase Dashboard, open **SQL Editor** on the left navigation.
2. Click **"New Query"**.
3. Copy the entire contents of [`supabase/schema.sql`](file:///c:/Users/user/.gemini/antigravity/scratch/dreport-studio-next/supabase/schema.sql) and paste them into the SQL Editor.
4. Click **"RUN"** (or press `Ctrl + Enter`).
5. Run the latest migration scripts from [`supabase/migrations/`](file:///c:/Users/user/.gemini/antigravity/scratch/dreport-studio-next/supabase/migrations/) (including `20261008_create_audit_logs_activity_trail.sql`).

#### What `schema.sql` Configures:
- **Tables**: `students`, `reports`, `schedules`, `schedule_student`, `feedbacks`, `dataset_entries`, `recommendation_datasets`, `app_settings`, `instructor_invitations`, and `audit_logs`.
- **Storage**: The `reports` public bucket for lesson documentation photos with RLS policies.
- **Functions & Triggers**: `generate_student_slug()`, `public.is_admin()`, and `public.transfer_student()`.

---

### Step 3: Configure Supabase Authentication

In Supabase Dashboard under **Authentication**:

#### 3.1. Email & Password Provider
1. Go to **Authentication** -> **Providers** -> **Email**.
2. Ensure **"Enable Email provider"** is checked.
3. Disable **"Confirm email"** to allow streamlined activation via the studio's internal token invitation flow.

#### 3.2. URL Configuration
1. Go to **Authentication** -> **URL Configuration**.
2. Set **Site URL** to your domain (e.g., `http://localhost:3000` or production URL).
3. Add to **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://your-domain.com/auth/callback`

---

### Step 4: Bootstrap First Super Admin Account

Since public registration is disabled, create your first administrative user manually:

1. Open **Authentication** -> **Users** -> **Add User** -> **Create User**.
2. Enter your admin email (e.g. `admin@institution.com`) and a temporary password. Check *Auto Confirm User*.
3. Open **SQL Editor** and execute:

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'admin@institution.com';
```

---

### Step 5: Configure Environment Variables

1. Copy the example configuration template:
   ```bash
   cp .env.example .env.local
   ```
2. Populate `.env.local`:

```env
# Supabase Credentials
NEXT_PUBLIC_SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."

# Brand & Notification Settings
NEXT_PUBLIC_APP_NAME="Daely Report Studio"
NEXT_PUBLIC_BRANCH_ADMIN_EMAIL="admin@yourinstitution.com"

# AI Engine Configuration
AI_PROVIDER="gemini"
AI_MODEL="gemini-2.5-flash"
AI_API_KEY="AIzaSy..."
```

---

### Step 6: Launch Development Server

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Access the application at [http://localhost:3000](http://localhost:3000).

---

## 4. End-to-End Operational Testing

Verify key operational workflows:

1. **Admin Login**: Sign in at `/login` using the bootstrap credentials created in Step 4.
2. **AI Configuration**: Navigate to **Settings** (`/settings`), save your Gemini API key and institution WhatsApp contact.
3. **Staff Invitation**: Navigate to **Instructors** (`/instructors`), click **"+ Invite Instructor"**, enter name and email, and copy the activation link.
4. **Staff Activation**: Open an incognito window, navigate to the activation link, set a username and password.
5. **Report Generation**: Add a student, create a lesson report with text or voice dictation, generate AI evaluation, attach a lesson photo, and save.
6. **Parent Portal**: Open the student's public portal (`/p/[slug]`), inspect the report, and test feedback submission.
7. **Audit Trail**: Switch back to the admin account and open **Instructors** -> **Audit Trail** tab to view recorded activities in real time.

---

## 5. Production Deployment (Vercel)

1. Push your repository to GitHub.
2. Import the repository into [Vercel](https://vercel.com).
3. Configure all environment variables matching `.env.local` in project settings.
4. Deploy the application.
5. Add the production Vercel URL to Supabase's **Redirect URLs**.

---

## 6. Troubleshooting FAQ

#### Q: The "Instructors" menu is missing from the sidebar after logging in.
> **Cause**: The account lacks `app_metadata.role = 'admin'`.  
> **Solution**: Run the Step 4 SQL query in Supabase SQL Editor and log back in.

#### Q: An instructor sees an error when signing in with Google.
> **Cause**: The email has not been whitelisted or invited by an administrator.  
> **Solution**: Invite the instructor's Gmail address via `/instructors` first.

#### Q: Lesson photos fail to display on the parent portal.
> **Cause**: The storage bucket `reports` is not public or lacks public select policy.  
> **Solution**: Re-run the bucket policy in `supabase/schema.sql`:
> ```sql
> CREATE POLICY "Allow public select on reports"
> ON storage.objects FOR SELECT USING (bucket_id = 'reports');
> ```
