# LinkedIn Scraper (Playwright + PostgreSQL)

Ini adalah **LinkedIn Scraper** yang dibangun menggunakan **Node.js** dan **Playwright**.
Berbeda dengan scraper sederhana berbasis file, proyek ini menggunakan arsitektur **Database-Driven** (PostgreSQL) yang mendukung manajemen antrian (queue), rotasi akun otomatis, dan penyimpanan data terstruktur (Hybrid Relational + JSONB).

---

## # Fitur Utama

- **Multi-Account & Smart Rotation:** Otomatis berganti akun jika satu akun sedang sibuk atau terkena limit. Menggunakan strategi _Least Recently Used_.
- **Queue System (Database):** Manajemen antrian URL target. Aman dari _crash_ (bisa resume otomatis).
- **Distributed Ready:** Menggunakan _Atomic Locking_ (`SKIP LOCKED`), aman dijalankan oleh banyak worker/laptop sekaligus tanpa berebut tugas/akun.
- **Full Profile Scraping:** Mengambil detail lengkap:
  - Profile (Name, Headline, Location, About, Photo)
  - Experience (termasuk deskripsi & nested roles)
  - Education (termasuk Grade/GPA)
  - Licenses & Certifications
  - Projects
  - Skills (termasuk jumlah endorsement)
  - Recommendations (Received)
- **Session Sync:** Sinkronisasi cookies otomatis antara File Lokal dan Database.
- **Hybrid Storage:** Menggunakan PostgreSQL dengan struktur Relational untuk metadata pencarian dan JSONB untuk detail data yang fleksibel.

<br />

> **⚠️ `DISCLAIMER PENTING`**
> Script ini dibuat **HANYA UNTUK TUJUAN PEMBELAJARAN & RISET** (Educational Purpose).
> Saya tidak bertanggung jawab atas pemblokiran akun (Banned) atau pelanggaran Terms of Service LinkedIn akibat penggunaan script ini.
> **Gunakan akun cadangan/dummy** dan bijaklah dalam mengatur delay scraping.

---

## Prasyarat

1.  **Node.js** (v20 ke atas).
2.  **PostgreSQL** (Wajib install dan running).

---

## # Cara Instalasi & Setup

### 1. Clone & Install Dependencies

```bash
git clone <repo-url>
cd scrap-playwright
npm install
```

### 2. Konfigurasi Database

Buat database baru di PostgreSQL bernama scrap_playwright. Lalu jalankan query SQL berikut di query tool (pgAdmin/DBeaver) untuk membuat tabel:

```SQL
-- Tabel Akun (Multi-Tenant, Rotation & Rate Limiter)
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    cookies JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    is_busy BOOLEAN DEFAULT FALSE, -- Penanda sedang dipakai worker

    -- Rate Limiting Logic
    hourly_count INT DEFAULT 0,    -- Hitungan pemakaian per jam
    last_used TIMESTAMP,           -- Waktu terakhir dipakai

    note TEXT,                     -- Catatan tambahan (misal: Akun Utama/Cadangan)
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Tabel Antrian (Queue System)
CREATE TABLE scrape_queue (
    id SERIAL PRIMARY KEY,
    target_url TEXT UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, done, failed
    attempts INT DEFAULT 0,
    error_log TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Tabel Data Profil (Hybrid Relational + JSONB)
CREATE TABLE profiles (
    id SERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,

    -- Kolom Utama (Mudah di-search/filter)
    name VARCHAR(255),
    headline TEXT,
    location VARCHAR(255),
    about TEXT,
    photo_url TEXT,

    -- Kolom Detail (JSONB - Fleksibel terhadap perubahan struktur)
    experiences JSONB DEFAULT '[]',
    educations JSONB DEFAULT '[]',
    certifications JSONB DEFAULT '[]',
    projects JSONB DEFAULT '[]',
    skills JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',

    -- Status & Catatan (Untuk Fallback/Error handling)
    status VARCHAR(20) DEFAULT 'success',
    note TEXT,

    -- Metadata
    scraped_at TIMESTAMP DEFAULT NOW()
);

-- Indexing untuk performa query JSON
CREATE INDEX idx_profiles_experiences ON profiles USING GIN (experiences);
CREATE INDEX idx_profiles_skills ON profiles USING GIN (skills);
```

### 3. Setup Environment (.env)

Buat file .env di root folder dan isi kredensial Database serta akun LinkedIn (untuk seeding awal).

```
# Database Config
DB_USER=postgres
DB_PASS=password_postgres_kamu
DB_HOST=localhost
DB_PORT=5432
DB_NAME=scrap_playwright
```

### 4. Seed Akun ke Database

Buat file accounts.json di root folder (sejajar dengan app.js) dan isi dengan daftar akun yang ingin digunakan:

```json
[
  {
    "email": "akun1@gmail.com",
    "password": "password123",
    "note": ""
  },
  {
    "email": "akun2@yahoo.com",
    "password": "rahasia456",
    "note": ""
  }
]
```

Pastikan accounts.json sudah masuk ke .gitignore agar kredensial aman.

```
node seed-account.js
```

(Ulangi langkah ini jika ingin menambah akun baru atau mereset limit/status akun).

## # Cara Menjalankan

Jalankan server Express:

```
npm run start
# Server akan berjalan di http://localhost:4000
```

## # API Documentation

#### 1. Masukkan URL ke Antrian (Input Batch)

**Endpoint:** `POST /queue/add`

**Body (JSON):**

```json
{
  "urls": [
    {
      "url": "[https://www.linkedin.com/in/target-user-1/](https://www.linkedin.com/in/target-user-1/)"
    },
    {
      "url": "[https://www.linkedin.com/in/target-user-2/](https://www.linkedin.com/in/target-user-2/)"
    },
    {
      "url": "[https://www.linkedin.com/in/target-user-3/](https://www.linkedin.com/in/target-user-3/)"
    }
  ]
}
```

**Body (JSON):**

```json
{
  "success": true,
  "message": "3 URL berhasil masuk antrian."
}
```

#### 2. Nyalakan Worker (Mesin Scraping)

Endpoint ini memerintahkan server untuk mulai memproses antrian yang menumpuk.

**Endpoint:** `GET /worker/start`

* Script worker akan berjalan di *background*.
* **Alur Kerja Cerdas:**
    1.  **Cek Antrian:** Mengambil 1 URL `pending` dari Queue.
    2.  **Cek Akun Aman:** Mencari akun yang `idle` (tidak sibuk) **DAN** kuota pemakaiannya belum mencapai limit (10 view/jam). Jika semua akun limit habis, worker akan istirahat otomatis.
    3.  **Sync Session:** Login otomatis menggunakan cookies terbaru dari database (support multi-device).
    4.  **Scraping & Fallback:** Mencoba mengambil data detail. Jika gagal/kosong, otomatis mengambil data *summary* dari halaman depan sebagai cadangan.
    5.  **Simpan Hasil:** Data disimpan ke tabel `profiles` lengkap dengan catatan (Note) jika menggunakan data fallback.
    6.  **Cleanup:** Status URL diubah jadi `done`, browser ditutup, dan akun dilepas agar bisa dipakai worker lain.
* **Monitoring:** Pantau progress log secara realtime di terminal VS Code.

---

## # Struktur Project

Berikut adalah struktur folder proyek setelah refactoring ke arsitektur Database:

- **`controllers/`**
  - `LinkedInController.js`: Menangani request masuk dari API (`addToQueue`, `startWorker`, `scrape`).
- **`services/`**
  - `LinkedInService.js`: Otak utama aplikasi. Mengatur loop worker, logika rotasi akun, dan pemanggilan scraper.
- **`scrapers/`**
  - `CompositeScraper.js`: Facade yang menjalankan semua scraper kecil di bawahnya.
  - `ProfileScraper.js`, `ExperienceScraper.js`, dll: Logic Playwright spesifik per section.
- **`database/`**
  - `ProfileRepository.js`: Menyimpan hasil scrape ke tabel `profiles`.
  - `QueueRepository.js`: Mengatur antrian (Add, Get Next Pending, Update Status) dengan _Atomic Locking_.
- **`config/`**
  - `db.js`: Konfigurasi koneksi PostgreSQL (Connection Pool).
- **`helpers/`**
  - `getIdleAccount.js`: Logic untuk mencari akun yang sedang nganggur di DB.
- **`session/`**
  - `SessionManager.js`: Mengatur load/save cookies, sinkronisasi DB <-> Local, dan launch browser context.
- **`sessions_data/`**
  - _(Auto-generated)_ Folder lokal untuk menyimpan file cookies sementara agar load browser lebih cepat.

---

## # Tips Anti-Banned & Deployment

1.  **Proxy (Wajib untuk Cloud):**
    Jika deploy ke AWS/GCP/DigitalOcean, **WAJIB** gunakan **Residential Proxy**. IP Datacenter akan langsung terdeteksi dan diblokir oleh LinkedIn.
2.  **Delay Manusiawi:**
    Script sudah diset memiliki random delay 3-7 detik antar profil dan simulasi scroll/keyboard press. Jangan dipercepat/dihilangkan.
3.  **Rotasi Akun:**
    Masukkan minimal 3-5 akun dummy ke database jika ingin scrape > 100 data per hari. Worker otomatis akan meratakan beban kerja ke semua akun tersebut.
4.  **Headless Mode:**
    Untuk deployment di server Linux (tanpa layar/GUI), ubah `headless: false` menjadi `headless: true` di file `src/session/SessionManager.js`. Pastikan juga tetap menggunakan User-Agent asli di parameter `args`.
