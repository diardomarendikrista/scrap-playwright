// src/services/LinkedInService.js
const SessionManager = require("../session/SessionManager");
const CompositeScraper = require("../scrapers/CompositeScraper");
const ProfileRepository = require("../database/ProfileRepository");
const QueueRepository = require("../database/QueueRepository");
const { getIdleAccount, releaseAccount } = require("../helpers/getIdleAccount");

class LinkedInService {
  /**
   * MODE MANUAL: Scrape langsung dari array URL yang dikirim via API
   * Berguna untuk testing cepat.
   */
  async scrapeProfiles(urlList, email) {
    // Load Browser sesuai email yang dipilih
    const browser = await SessionManager.loadBrowser(email);

    try {
      // Validasi Login
      await SessionManager.validateOrLogin(browser, email);

      const results = [];
      const composite = new CompositeScraper(browser);

      for (const item of urlList) {
        const url = item.url;
        console.log(`\n=== [Manual] Mulai Scraping: ${url} ===`);

        try {
          const data = await composite.scrapeAll(url);

          // Inject URL & Simpan ke DB
          data.url = url;
          await ProfileRepository.save(data);

          results.push({ url, status: "success", saved_db: true, data });
        } catch (e) {
          console.error(`[Manual] Gagal scrape ${url}:`, e.message);
          results.push({ url, status: "failed", error: e.message });
        }

        // Delay agar tidak terdeteksi bot
        await new Promise((r) => setTimeout(r, Math.random() * 3000 + 2000));
      }

      return results;
    } catch (error) {
      throw error;
    } finally {
      await browser.close();
    }
  }

  /**
   * MODE WORKER: Otomatis mengambil antrian dari Database
   * Mendukung rotasi akun dan update status antrian.
   */
  async startQueueWorker() {
    console.log("=== WORKER STARTED: Menunggu antrian... ===");

    let isRunning = true;

    while (isRunning) {
      let currentEmail = null;
      let browser = null;

      try {
        // Ambil URL Pending dari Queue
        const task = await QueueRepository.getNextPending();

        if (!task) {
          console.log("Antrian kosong. Istirahat 10 detik...");
          await new Promise((r) => setTimeout(r, 10000));
          continue;
        }

        // Ambil Akun yang sedang idle (Rotasi)
        const account = await getIdleAccount();
        if (!account) {
          console.log("Tidak ada akun tersedia/aktif! Menunggu 10 detik...");
          // Kembalikan status task jadi pending lagi karena belum dikerjakan
          await QueueRepository.updateStatus(task.id, "pending");
          await new Promise((r) => setTimeout(r, 10000));
          continue;
        }

        currentEmail = account.email;
        console.log(
          `Worker pakai akun: ${currentEmail} untuk URL: ${task.target_url}`
        );

        // Load Browser & Login
        browser = await SessionManager.loadBrowser(currentEmail);
        await SessionManager.validateOrLogin(browser, currentEmail);

        // Proses Scraping
        const composite = new CompositeScraper(browser);
        console.log(`[Queue ID: ${task.id}] Processing...`);

        // Update status antrian jadi 'processing' (opsional, sbnrnya sudah di getNextPending kalau pakai logic update)
        // await QueueRepository.updateStatus(task.id, "processing");

        const data = await composite.scrapeAll(task.target_url);
        data.url = task.target_url;

        // Simpan Data Profil ke DB
        await ProfileRepository.save(data);

        // Tandai Selesai di Queue
        await QueueRepository.updateStatus(task.id, "done");
        console.log(`[Queue ID: ${task.id}] Status -> DONE`);
      } catch (error) {
        console.error(`[Worker Error]:`, error.message);

        // Jika error terjadi saat memproses task tertentu, update status task
        // (Variabel 'task' mungkin tidak scope di sini kalau errornya di level atas,
        // tapi logika try-catch di dalam loop biasanya aman)
      } finally {
        // CLEANUP
        if (browser) {
          await browser.close();
        }

        // Lepaskan akun agar bisa dipakai worker lain/batch selanjutnya
        if (currentEmail) {
          await releaseAccount(currentEmail);
          console.log(`Akun ${currentEmail} dilepas.`);
        }

        // Delay antar antrian agar seperti manusia
        await new Promise((r) => setTimeout(r, Math.random() * 5000 + 3000));
      }
    }
  }
}

module.exports = new LinkedInService();
