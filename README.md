# Daely Report Studio

> Sistem otomasi laporan progres belajar murid cerdas bertenaga AI untuk lembaga kursus, bimbel, dan pengajar privat — dilengkapi dengan portal publik interaktif untuk orang tua murid.

[![License: Commercial](https://img.shields.io/badge/License-Commercial-blue.svg)](LICENSE)
[![Framework: Next.js 16](https://img.shields.io/badge/Framework-Next.js%2016-black.svg)](https://nextjs.org/)
[![Database: Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E.svg)](https://supabase.com/)
[![Language: TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6.svg)](https://www.typescriptlang.org/)

---

## 1. Arsitektur Sistem

```mermaid
graph TD
    Client[Browser Pengajar / Admin] -->|Next.js App Router| NextServer[Next.js Server Runtime]
    Parent[Portal Orang Tua /p/slug] -->|Public Read-Only| NextServer
    
    subgraph Supabase Cloud [Supabase Managed Backend]
        NextServer -->|PostgreSQL Queries & Auth| DB[(PostgreSQL Database)]
        NextServer -->|Storage Bucket 'reports'| Storage[Supabase Storage]
        DB -->|RLS Security Policies| RLS[Row Level Security]
    end

    subgraph AI Engine [AI Generation Service]
        NextServer -->|Server-side Private Request| Gemini[Google Gemini API]
        NextServer -->|Server-side Private Request| Groq[GroqCloud Llama API]
    end
```

---

## 2. Fitur Unggulan Komersial

- **Mesin Generate Laporan AI Few-Shot**: Menghasilkan draf laporan terstruktur (Overview, Catatan Guru, Rekomendasi Latihan, dan Catatan Orang Tua) dengan gaya bahasa alami yang meniru contoh dataset Anda.
- **Portal Publik Interaktif Wali Murid (`/p/[slug]`)**: Halaman transparan dan elegan bagi orang tua untuk memantau progres belajar, sorotan foto dokumentasi, riwayat pertemuan, dan mengirim masukan balik.
- **Dukungan Multibahasa Instan (i18n)**: Beralih mulus antara Bahasa Indonesia (ID) dan Bahasa Inggris (EN).
- **Arsitektur Keamanan Berlapis (Security-Hardened)**:
  - Row Level Security (RLS) PostgreSQL untuk isolasi multi-tenant data antar guru.
  - Kunci API AI diamankan secara eksklusif di server runtime (`SUPABASE_SERVICE_ROLE_KEY` / `AI_API_KEY`).
  - Proteksi Rate Limiting *sliding-window* in-memory (10 request/menit per pengguna) dan validasi batas panjang input observasi.
  - Query portal publik terindeks $O(1)$ untuk kecepatan akses dan pencegahan kebocoran data murid lain.
- **Manajemen Guru & Transfer Murid (Super Admin)**: Kemampuan administrator cabang memindahkan murid antar guru secara instan berikut seluruh riwayat laporannya.
- **White-Label Ready**: Mudah di-*rebrand* menjadi nama dan logo lembaga Anda sendiri dalam hitungan menit.

---

## 3. Panduan Instalasi Cepat (Quickstart)

### Prasyarat Sistem
- Node.js versi `20.x` atau lebih baru
- npm, pnpm, atau yarn
- Akun gratis di [Supabase](https://supabase.com/)
- Akun gratis di [Google AI Studio](https://aistudio.google.com/) (untuk API Key Gemini)

---

### Langkah 1: Kloning & Instalasi Dependensi
```bash
git clone https://github.com/revanzaRaihan/daereport.git
cd daereport
npm install
```

---

### Langkah 2: Setup Database Supabase (Sekali Eksekusi)
1. Buat project baru di [Supabase Dashboard](https://supabase.com/dashboard).
2. Buka menu **SQL Editor** pada project Supabase Anda.
3. Buka file [`supabase/schema.sql`](file:///c:/Users/user/.gemini/antigravity/scratch/dreport-studio-next/supabase/schema.sql) di repositori ini, salin seluruh kodenya, tempel (*paste*) ke SQL Editor, dan klik **Run**.
4. *(Opsional)* Untuk mengisi dataset contoh bawaan awal, buka file [`supabase/seed.sql`](file:///c:/Users/user/.gemini/antigravity/scratch/dreport-studio-next/supabase/seed.sql), tempel ke SQL Editor, dan klik **Run**.
5. Buka menu **Storage** -> **New Bucket**:
   - Beri nama bucket: `reports`
   - Aktifkan opsi **Public bucket** (agar foto dokumentasi dapat dimuat di portal orang tua).

---

### Langkah 3: Konfigurasi Environment Variable
Salin file template `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```

Buka `.env.local` dan lengkapi nilainya:
```env
# Dapatkan di Supabase Dashboard -> Project Settings -> API
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5c...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5c...

# Kredensial AI (Google AI Studio)
AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash
AI_API_KEY=AIzaSy...

# Branding & Notifikasi
NEXT_PUBLIC_APP_NAME="Nama Lembaga Anda"
NEXT_PUBLIC_BRANCH_ADMIN_EMAIL=admin@lembagaanda.com
```

---

### Langkah 4: Menjalankan Aplikasi
Jalankan server pengembangan lokal:
```bash
npm run dev
```
Buka browser pada [http://localhost:3000](http://localhost:3000).

---

## 4. Cara Membuat Akun Administrator Pertama

Karena pendaftaran publik mandiri telah ditutup demi keamanan kuota AI dan privasi murid, akun administrator pertama dibuat secara langsung:

1. Buka **Supabase Dashboard** -> **Authentication** -> **Users** -> **Add User** -> **Create User**.
2. Masukkan email admin Anda (misal `admin@lembaga.com`) dan buat password.
3. Buka **SQL Editor** pada Supabase Dashboard dan jalankan:
   ```sql
   UPDATE auth.users
   SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
   WHERE email = 'admin@lembaga.com';
   ```
4. Login di `/login` dengan akun tersebut. Akun Anda kini resmi memiliki status **Super Admin** terlindungi (*anti-tampering*).
5. Untuk menambah staf/guru pengajar lainnya, gunakan menu **Instruktur (`/instructors`)** untuk mengirimkan tautan aktivasi mandiri.

---

## 5. Dokumentasi & Panduan Lanjutan

Pelajari panduan spesifik dan mendalam lainnya yang tersedia di repositori ini:
- 🚀 **[Panduan Lengkap Implementasi dari Nol (`docs/specifics/GUIDELINE_IMPLEMENTASI_DARI_NOL.md`)](file:///c:/Users/user/.gemini/antigravity/scratch/dreport-studio-next/docs/specifics/GUIDELINE_IMPLEMENTASI_DARI_NOL.md)**
- 🎨 **[Panduan Kustomisasi Brand & White-Labeling (`docs/WHITE_LABEL_GUIDE.md`)](file:///c:/Users/user/.gemini/antigravity/scratch/dreport-studio-next/docs/WHITE_LABEL_GUIDE.md)**
- 🛡️ **[Laporan Audit Keamanan & Alur Kerja (`docs/AUDIT_WORKFLOW_DAN_KEAMANAN_SISTEM.md`)](file:///c:/Users/user/.gemini/antigravity/scratch/dreport-studio-next/docs/AUDIT_WORKFLOW_DAN_KEAMANAN_SISTEM.md)**

---

## 6. Lisensi Perangkat Lunak

Aplikasi ini dilindungi oleh lisensi komersial kepemilikan tunggal. Pembeli berhak mengoperasikan, memodifikasi, dan men-*deploy* kode sumber untuk kepentingan internal institusi atau klien tunggal, namun dilarang keras menjual kembali atau menyebarluaskan kode sumber secara bebas.

Detail lengkap hak dan batasan tercantum pada file [LICENSE](file:///c:/Users/user/.gemini/antigravity/scratch/dreport-studio-next/LICENSE).
