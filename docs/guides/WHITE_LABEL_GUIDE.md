# Panduan White-Label & Kustomisasi Identitas Brand (White-Labeling Guide)

Dokumen ini menjelaskan langkah-langkah bagi pembeli source code atau tim pengembang untuk mengganti identitas merek (*rebranding*) aplikasi Daely Report menjadi merek lembaga atau sekolah Anda sendiri dalam hitungan menit.

---

## 1. Mengubah Nama Lembaga / Aplikasi

Seluruh nama aplikasi diatur secara terpusat melalui environment variable dan modul konfigurasi [`src/lib/branding.ts`](file:///c:/Users/user/.gemini/antigravity/scratch/dreport-studio-next/src/lib/branding.ts).

### Langkah:
1. Buka file `.env.local` (atau konfigurasi Environment Variables di platform hosting seperti Vercel).
2. Tambahkan atau sesuaikan variabel:
   ```env
   NEXT_PUBLIC_APP_NAME="Nama Lembaga Anda"
   ```
3. Nama ini otomatis diterapkan pada:
   - Header dan Sidebar Dashboard Guru & Admin
   - Judul Tab Browser (HTML Title Tag & OpenGraph Metadata)
   - Layar Login dan Pendaftaran
   - Subjek email notifikasi masukan dari orang tua
   - Footer hak cipta di portal publik orang tua (`/p/[slug]`)

---

## 2. Mengganti Logo dan Ikon Aplikasi

Seluruh aset grafis logo disimpan di dalam direktori `public/`.

### Lokasi File:
1. **Logo Utama Aplikasi:**
   - File: `public/logo.png`
   - Rekomendasi format: PNG transparan, rasio 1:1 (persegi), resolusi minimal 512x512 piksel.
   - Digunakan pada: Sidebar, Layar Login, Header Mobile, dan Favicon browser.

2. **Favicon / Shortcut Icon:**
   - Dikonfigurasi otomatis melalui `src/app/layout.tsx` mengarah ke `public/logo.png` atau file `public/favicon.ico`.

### Tips Penggantian Logo:
Cukup gantikan file `public/logo.png` dengan logo institusi Anda yang baru dengan nama file yang sama, lalu refresh browser dengan `Ctrl + F5` (hard refresh).

---

## 3. Mengatur Email Penerima Masukan Orang Tua

Saat orang tua mengirimkan masukan atau pertanyaan melalui portal publik murid, notifikasi dapat langsung dikirimkan ke email cabang atau manajemen sekolah Anda.

### Konfigurasi di `.env.local`:
```env
NEXT_PUBLIC_BRANCH_ADMIN_EMAIL="admin@sekolahanda.com"
```

Jika variabel ini tidak diisi, sistem akan menggunakan nilai default `admin@school.com`.

---

## 4. Konfigurasi Mesin AI (Google Gemini / Groq)

Sistem mendukung fleksibilitas pemilihan provider AI:
1. **Google Gemini (Direkomendasikan)**:
   ```env
   AI_PROVIDER=gemini
   AI_MODEL=gemini-2.5-flash
   AI_API_KEY=AIzaSy...
   ```
2. **Groq Cloud (Ultra Cepat)**:
   ```env
   AI_PROVIDER=groq
   AI_MODEL=llama-3.1-8b-instant
   AI_API_KEY=gsk_...
   ```

*Catatan: Admin juga dapat mengupdate API key secara dinamis melalui menu Pengaturan di dalam dashboard aplikasi tanpa perlu redeploy kode.*
