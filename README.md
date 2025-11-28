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
-- 1. Tabel Akun (Multi-Tenant & Rotation)
CREATE TABLE accounts (
id SERIAL PRIMARY KEY,
email VARCHAR(255) UNIQUE NOT NULL,
password VARCHAR(255) NOT NULL,
cookies JSONB,
is_active BOOLEAN DEFAULT TRUE,
is_busy BOOLEAN DEFAULT FALSE, -- Penanda sedang dipakai worker
last_used TIMESTAMP,
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
# Akun LinkedIn (Hanya untuk seeding awal via script)
LINKEDIN_EMAIL=email_dummy@gmail.com
LINKEDIN_PASSWORD=password_rahasia

# Database Config
DB_USER=postgres
DB_PASS=password_postgres_kamu
DB_HOST=localhost
DB_PORT=5432
DB_NAME=scrap_playwright
```

### 4. Seed Akun ke Database

Masukkan akun LinkedIn dari .env ke dalam tabel database agar bisa dipakai oleh worker.

```
node seed-account.js
```

(Ulangi langkah ini dengan mengubah .env jika ingin mendaftarkan banyak akun sekaligus).

## # Cara Menjalankan

Jalankan server Express:

```
npm run start
# Server akan berjalan di http://localhost:4000
```

## # API Documentation

Ada dua metode penggunaan: **Mode Queue (Disarankan)** untuk scraping massal, dan **Mode Manual** untuk testing cepat.

### A. Mode Queue (Best Practice untuk Bulk Data)

Gunakan mode ini jika ingin scrape ratusan/ribuan data. Worker akan berjalan di background, mengambil antrian dari DB, dan otomatis berganti akun jika akun saat ini sibuk/limit.

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

**Endpoint:** `GET /worker/start`

- Script worker akan mulai berjalan di _background_ server.
- **Alur Kerja Worker:**
  1.  Cek tabel `scrape_queue` untuk status `pending`.
  2.  Cek tabel `accounts` untuk mencari akun yang `idle` (tidak sibuk & paling lama istirahat).
  3.  Login / Sync Session cookies dari DB ke Local.
  4.  Scrape data target -> Simpan hasil ke tabel `profiles`.
  5.  Update status URL menjadi `done`.
  6.  Lepaskan akun (set `is_busy = false`) agar bisa dipakai lagi.
- **Monitoring:** Pantau progress log secara realtime di terminal VS Code / Server log.

---

### B. Mode Manual (Direct Scrape)

Gunakan mode ini hanya untuk testing cepat satu profil secara langsung (synchronous). Hasil scrape akan langsung dikembalikan sebagai JSON response (dan juga disimpan ke DB).

**Endpoint:** `POST /scrape`

**Body (JSON):**

```json
{
  "email": "email_akun_bot_di_db@gmail.com",
  "urls": [
    {
      "url": "[https://www.linkedin.com/in/target-user/](https://www.linkedin.com/in/target-user/)"
    }
  ]
}
```

- **Catatan:** Field `email` **wajib diisi** agar script tahu akun mana yang harus dipakai dari database. Tidak perlu mengirim password.

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
