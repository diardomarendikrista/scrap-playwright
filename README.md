# scrap-playwright

Script ini dibuat untuk tujuan **pembelajaran** Playwright, otomasi browser, dan teknik scraping dasar.  
**Gunakan secara bertanggung jawab.**  
Saya **tidak bertanggung jawab** atas penyalahgunaan atau aktivitas yang melanggar Terms of Service platform mana pun.

> !! Catatan Penting  
> LinkedIn memiliki kebijakan anti-scraping. Jika Anda menggunakan script ini untuk mengakses LinkedIn, pastikan Anda memiliki izin yang jelas.  
> Contoh di bawah hanya untuk tujuan demonstrasi.

## Cara Menggunakan

### 1. Siapkan file `.env`

Buat file `.env` berdasarkan `env.example` dan isi dengan:

```
LINKEDIN_EMAIL=youremail@example.com
LINKEDIN_PASSWORD=yourpassword
```

**Hanya gunakan akun test**, bukan akun utama.

---

## 2. Jalankan server

```bash
npm install
npm run start
```

---
## 3. Kirim request via Postman

### Endpoint: POST /scrape
### Request Body
```JSON
{
    "urls": [
        {
            "url": "https://www.linkedin.com/in/{USER_1}/"
        },
        {
            "url": "https://www.linkedin.com/in/{USER_2}/"
        },
        // data lainnya
    ]
}
```

Endpoint ini akan mengunjungi setiap URL menggunakan Playwright dan mengambil data sesuai logic di dalam folder /scrapers


---
## ⚠️ Disclaimer

Script ini hanya template. Anda bertanggung jawab atas apa yang Anda scrape. <br />
Jangan gunakan untuk mengakses halaman atau data yang Anda tidak memiliki izin untuk akses. <br />
Simpan kredensial dengan aman. Jangan commit .env atau password ke Git.

---
## Catatan Tambahan

Script ini menggunakan Playwright. Anda bebas mengedit logic scraping di scraper.js. <br />
Login pertama kali mungkin memerlukan verifikasi manual (captcha, OTP, dll). <br />
Untuk menghindari pemblokiran, gunakan session reuse dengan storageState.