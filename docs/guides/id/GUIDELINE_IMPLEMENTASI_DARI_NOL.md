# Panduan Lengkap Implementasi & Setup Daely Report Studio dari Nol (Zero to Production)

Panduan ini disusun secara komprehensif untuk pengembang (**developer**) maupun pemilik lembaga (**administrator**) yang ingin mengimplementasikan, men-deploy, dan memahami alur kerja **Daely Report Studio** dari awal (clean setup) hingga siap digunakan dalam operasional produksi.

---

## 1. Ikhtisar Arsitektur Sistem

Daely Report Studio mengusung arsitektur modern berbasis **Next.js 16 (App Router & `proxy.ts`)** dan **Supabase Platform**:

```
                               ┌───────────────────────────────────────────────┐
                               │           Daely Report Studio                 │
                               │          (Next.js 16 App Router)              │
                               └───────┬───────────────────────────────┬───────┘
                                       │                               │
                       ┌───────────────▼──────────────┐ ┌──────────────▼──────────────┐
                       │   Supabase Auth & RLS         │ │    Google Gemini AI Engine   │
                       │   (Multi-Pengajar Terisolasi)│ │    (Pembuat Laporan Otomatis)│
                       └───────────────┬──────────────┘ └──────────────────────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
     [Admin Lembaga]           [Guru / Instruktur]        [Portal Orang Tua]
   • Whitelist Staf           • Data Murid Sendiri       • Tautan /p/[slug]
   • Konfigurasi AI           • Buat Draf Evaluasi       • Baca Riwayat Belajar
   • Safe Deoffboarding       • Kotak Masuk Feedback     • Kirim Masukan (Cooldown)
   • Jejak Audit (Logs)       • Dikte Suara Observasi    • Unduh / Cetak Laporan
```

### Karakteristik Keamanan & Keandalan Utama
1. **Otentikasi Berbasis Whitelist & Aktivasi Mandiri**:
   - Registrasi publik mandiri ditutup untuk mencegah pengguna luar menguras kuota token AI lembaga.
   - Admin mengundang instruktur melalui portal internal.
   - Instruktur melakukan aktivasi mandiri membuat username & kata sandi melalui tautan token khusus.
   - Google OAuth callback menerapkan *auto-purge* (akun tidak terdaftar langsung dihapus otomatis).
2. **Hak Akses Admin Anti-Tampering (`app_metadata`)**:
   - Hak admin dikunci murni pada `app_metadata` Supabase yang hanya bisa diatur oleh server melalui `service_role`.
   - Aman dari eskalasi hak akses (*privilege escalation*) via manipulasi client browser `user_metadata`.
3. **Isolasi Murid (Multi-Tenant Row Level Security)**:
   - Guru hanya dapat melihat, mengedit, dan menghapus murid yang menjadi bimbingannya sendiri (`user_id = auth.uid()`).
   - Admin memiliki akses supervisi global dan dapat mentransfer murid antar-guru.
4. **Alur Proteksi Deoffboarding Aman (*Safe Deoffboarding Workflow*)**:
   - Mencegah data murid menjadi yatim (*orphan*) saat instruktur dinonaktifkan.
   - Jika guru masih mengampu murid aktif, sistem mewajibkan pengalihan seluruh murid ke guru pengganti sebelum akun dihapus.
5. **Jejak Audit Operasional (*Audit Logs Trail*)**:
   - Seluruh mutasi kritis (transfer murid, update AI key, undangan guru, hapus laporan) tercatat dalam tabel append-only `public.audit_logs` yang hanya dapat dibaca oleh Admin.
6. **Konvensi Modern Next.js 16 (`proxy.ts`)**:
   - Menggunakan standar terbaru `src/proxy.ts` sebagai pengganti `middleware.ts` lama untuk efisiensi proteksi rute dan sesi Supabase.

---

## 2. Prasyarat Sistem (Prerequisites)

Pastikan lingkungan lokal atau server Anda memiliki:
1. **Node.js**: Versi `20.x` LTS ke atas.
2. **Package Manager**: `npm` (bawaan Node.js), `pnpm`, atau `yarn`.
3. **Git**: Untuk clone repositori dan version control.
4. **Akun Supabase**: Daftar gratis di [supabase.com](https://supabase.com).
5. **API Key Google Gemini**: Dapatkan gratis di [Google AI Studio](https://aistudio.google.com).
6. **(Opsional) Google Cloud Console**: Jika ingin mengaktifkan opsi tombol *Login with Google* untuk staf terdaftar.

---

## 3. Langkah Demi Langkah Setup dari Nol

### Langkah 1: Persiapan Proyek Supabase

1. Masuk ke dashboard [Supabase](https://supabase.com/dashboard) dan klik **"New Project"**.
2. Isi nama proyek (contoh: `daely-report-studio`), password database yang kuat, dan pilih region terdekat (misal: *Singapore*).
3. Setelah proyek selesai dibuat (~1-2 menit), buka menu **Project Settings** (ikon gerigi) -> **API**.
4. Catat 3 kunci penting berikut:
   - **Project URL** (contoh: `https://xyzcompany.supabase.co`)
   - **Project API Keys -> `anon` / `public`**
   - **Project API Keys -> `service_role` / `secret`** *(PENTING: Jangan bocorkan ke client/frontend)*

---

### Langkah 2: Eksekusi Skema Basis Data Master (`schema.sql`)

Proyek ini telah menyediakan file skema master tunggal yang mencakup seluruh tabel, indeks performa, fungsi trigger, dan aturan keamanan RLS:

1. Di Dashboard Supabase, buka menu **SQL Editor** di sidebar kiri.
2. Klik **"New Query"**.
3. Buka file [`supabase/schema.sql`](file:///c:/Users/user/.gemini/antigravity/scratch/dreport-studio-next/supabase/schema.sql) dari repositori proyek ini, salin seluruh isinya, dan tempelkan ke SQL Editor Supabase.
4. Klik tombol **"RUN"** (atau tekan `Ctrl + Enter`).
5. Jalankan juga skrip migrasi terbaru di [`supabase/migrations/`](file:///c:/Users/user/.gemini/antigravity/scratch/dreport-studio-next/supabase/migrations/) (seperti `20261008_create_audit_logs_activity_trail.sql`).

#### Apa yang Dibuat oleh `schema.sql`?
- **Tabel Inti**:
  - `students`: Data murid, level, nama wali, nomor WA, preferensi bahasa laporan ('id' / 'en'), dan unique slug.
  - `reports`: Laporan progres belajar, evaluasi materi, sikap, dan URL foto dokumentasi.
  - `schedules` & `schedule_student`: Penjadwalan les dan relasi murid.
  - `feedbacks`: Masukan dari orang tua murid via portal publik.
  - `dataset_entries` & `recommendation_datasets`: Koleksi gaya bahasa AI dan rekomendasi materi.
  - `app_settings`: Kredensial AI terenkripsi, nomor WA cabang, dan whitelist undangan.
  - `instructor_invitations`: Catatan token undangan aktivasi instruktur baru.
  - `audit_logs`: Catatan jejak audit aktivitas administratif studio.
- **Storage Bucket**:
  - Bucket `reports` untuk menyimpan foto dokumentasi belajar murid dengan RLS terproteksi.
- **Fungsi Trigger Otomatis**:
  - `generate_student_slug()`: Membuat slug unik otomatis ramah URL saat murid baru didaftarkan.
  - `public.is_admin()`: Memeriksa hak admin secara aman murni melalui `app_metadata`.
  - `public.transfer_student()`: Memindahkan murid, riwayat laporan, dan feedback secara atomik.

---

### Langkah 3: Konfigurasi Otentikasi Supabase

Buka menu **Authentication** di sidebar Supabase:

#### 3.1. Pengaturan Email & Pendaftaran
1. Buka **Authentication** -> **Providers** -> **Email**.
2. Pastikan **"Enable Email provider"** aktif.
3. Nonaktifkan **"Confirm email"** jika Anda ingin aktivasi langsung aktif tanpa verifikasi email ganda bawaan Supabase (alur token aktivasi internal studio sudah menangani verifikasi).

#### 3.2. Pengaturan URL Redirect
1. Buka **Authentication** -> **URL Configuration**.
2. Atur **Site URL** ke domain Anda (misal `http://localhost:3000` untuk lokal atau `https://raport.lembaga.com` untuk produksi).
3. Tambahkan ke **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://domain-anda.com/auth/callback` (jika sudah deploy)

#### 3.3. Mengaktifkan Google OAuth (Opsional tapi Direkomendasikan)
Jika ingin pengajar dapat login cepat dengan tombol Google:
1. Buat OAuth Client ID di Google Cloud Console dengan redirect URI Supabase:
   `https://<project-id>.supabase.co/auth/v1/callback`
2. Masukkan Client ID dan Client Secret ke **Authentication** -> **Providers** -> **Google**.
3. *Catatan Keamanan*: Sistem DReport Studio secara otomatis menolak dan menghapus (*auto-purge*) akun Google asing yang tidak terdaftar di whitelist cabang.

---

### Langkah 4: Membuat Akun Administrator Pertama (Bootstrap Admin)

Karena registrasi publik ditutup, akun admin pertama dibuat langsung oleh pemilik sistem:

1. Buka **Authentication** -> **Users** di Supabase Dashboard.
2. Klik **"Add User"** -> **"Create User"**.
3. Masukkan email admin lembaga (contoh: `admin@lembaga.com`) dan buat password sementara. Centang *Auto Confirm User*.
4. Buka **SQL Editor**, jalankan perintah berikut untuk memberikan hak akses Admin tertinggi:

```sql
-- Ganti dengan email yang baru saja Anda buat di atas:
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'admin@lembaga.com';
```

---

### Langkah 5: Konfigurasi Environment Variables Proyek

1. Gandakan file `.env.example` menjadi `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Isi nilai-nilainya dengan kredensial yang didapatkan dari Langkah 1:

```env
# URL Supabase Proyek Anda
NEXT_PUBLIC_SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"

# Kunci Publik Anon Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."

# Kunci Rahasia Service Role (Backend Server Saja)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."

# Branding & Notifikasi
NEXT_PUBLIC_APP_NAME="Daely Report Studio"
NEXT_PUBLIC_BRANCH_ADMIN_EMAIL="admin@lembagaanda.com"

# Konfigurasi Mesin AI (Server-Side)
AI_PROVIDER="gemini"
AI_MODEL="gemini-2.5-flash"
AI_API_KEY="AIzaSy..."
```

---

### Langkah 6: Menjalankan Aplikasi di Komputer Lokal

1. Buka terminal di folder proyek:
   ```bash
   npm install
   ```
2. Jalankan server pengembang Next.js:
   ```bash
   npm run dev
   ```
3. Buka browser di [http://localhost:3000](http://localhost:3000).

---

## 4. Alur Kerja Uji Coba Operasional (End-to-End Walkthrough)

Setelah aplikasi berjalan, lakukan pengujian alur kerja berikut:

### 1. Login Sebagai Administrator
- Buka `http://localhost:3000/login`.
- Masukkan email dan password admin yang dibuat pada **Langkah 4**.
- Anda akan diarahkan ke Dashboard utama.

### 2. Konfigurasi Kunci AI di Menu Pengaturan
- Klik menu **Pengaturan** (`/settings`).
- Masukkan **Google Gemini API Key** dan nomor WhatsApp lembaga.
- Klik **Simpan Pengaturan** (Aktivitas ini otomatis dicatat di Jejak Audit).

### 3. Mengundang Guru / Instruktur Baru
- Klik menu **Instruktur** (`/instructors`) di sidebar. *(Menu ini hanya muncul untuk akun ber-role admin).*
- Klik tombol **"+ Undang Instruktur"**.
- Masukkan Nama Pengajar dan Email (misal: `guru@gmail.com`), pilih peran `Instructor`, lalu klik **Kirim Undangan**.
- Sistem akan menampilkan popup tautan aktivasi mandiri:
  `http://localhost:3000/auth/activate?token=xxxxxxxxxxxx`
- Salin tautan tersebut.

### 4. Aktivasi Akun oleh Guru Baru
- Buka jendela **Penyamaran (Incognito Window)** di browser Anda.
- Buka tautan aktivasi yang disalin tadi.
- Halaman aktivasi akan meminta guru membuat:
  - **Username / Nama Panggilan Pengajar** (misal: `Kak Budi`)
  - **Kata Sandi Baru**
- Klik tombol **Aktivasi Akun**.
- Akun guru kini aktif dan otomatis login ke dashboard guru.

### 5. Guru Mengelola Murid & Membuat Laporan
- Masuk ke menu **Murid** (`/students`) -> Tambah Murid baru (misal: "Kenzo").
- Buka menu **Buat Laporan** (`/`):
  - Pilih murid "Kenzo".
  - Masukkan materi pembelajaran dan catatan observasi (bisa gunakan fitur Dikte Suara 🎙️).
  - Klik **"Generate Report"** (AI Gemini akan menyusun laporan terstruktur).
  - Unggah foto dokumentasi belajar (foto otomatis dikompresi hemat storage).
  - Simpan Laporan.

### 6. Membuka Portal Publik Orang Tua
- Buka menu **Riwayat** (`/history`) atau kartu murid di `/students`.
- Klik tombol **"Buka Portal Ortu"** (`/p/[slug]`).
- Halaman publik ini dapat diakses oleh orang tua tanpa login.
- Coba kirim masukan di kolom **Feedback Wali Murid**.
- Coba kirim ulang pesan dalam 30 detik: sistem akan memicu *cooldown rate limit* untuk mencegah spam.

### 7. Memeriksa Jejak Audit (Audit Trail)
- Kembali ke akun admin, buka menu **Instruktur** (`/instructors`) -> klik tab **Jejak Audit**.
- Seluruh riwayat mutasi (undangan pengajar, pengaturan AI, pengalihan murid) akan tampil secara terurut dan transparan.

---

## 5. Deployment ke Produksi (Contoh: Vercel)

1. **Push ke GitHub**:
   Pastikan kode proyek Anda telah di-push ke repositori GitHub.
2. **Import Proyek ke Vercel**:
   - Masuk ke [vercel.com](https://vercel.com) -> Klik **"Add New Project"**.
   - Pilih repositori `daely-report-studio`.
3. **Atur Environment Variables di Vercel**:
   - Masukkan seluruh variabel dari `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, dsb.).
   - Pastikan `NEXT_PUBLIC_APP_URL` menggunakan domain produksi Anda (contoh: `https://raport.lembaga.com`).
4. **Deploy**:
   - Klik **Deploy**.
5. **Perbarui Redirect URL di Supabase**:
   - Buka Supabase Dashboard -> **Authentication** -> **URL Configuration**.
   - Tambahkan URL Vercel produksi ke **Redirect URLs**.

---

## 6. Pertanyaan Umum & Pemecahan Masalah (Troubleshooting FAQ)

#### Q: Mengapa menu "Instruktur" tidak muncul di sidebar setelah saya login?
> **Penyebab**: Akun Anda belum memiliki atribut `app_metadata.role = 'admin'`.  
> **Solusi**: Jalankan query SQL di Langkah 4 untuk email akun Anda, lalu lakukan *logout* dan *login* ulang agar token JWT diperbarui.

#### Q: Pengajar mencoba login dengan Google tetapi muncul error atau akun langsung terhapus?
> **Penyebab**: Akun Google tersebut belum didaftarkan/diundang oleh admin di menu `/instructors`.  
> **Solusi**: Admin harus mendaftarkan email Gmail tersebut terlebih dahulu melalui menu `/instructors` sebelum pengajar login via Google.

#### Q: Muncul error "Missing SUPABASE_SERVICE_ROLE_KEY"?
> **Penyebab**: Variabel lingkungan server belum diatur di `.env.local` atau Vercel.  
> **Solusi**: Salin kunci `service_role` (secret) dari Project Settings API Supabase ke `.env.local`. Jangan lupa restart dev server (`npm run dev`).

#### Q: Foto laporan yang diunggah guru tidak muncul di portal orang tua?
> **Penyebab**: Kebijakan RLS storage Supabase belum mengizinkan `public select`.  
> **Solusi**: Pastikan Anda telah mengeksekusi `supabase/schema.sql` secara utuh. File tersebut sudah menyertakan policy:
> ```sql
> CREATE POLICY "Allow public select on reports"
> ON storage.objects FOR SELECT USING (bucket_id = 'reports');
> ```
