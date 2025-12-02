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
      let taskId = null;

      try {
        // Ambil URL Pending dari Queue
        const task = await QueueRepository.getNextPending();

        if (!task) {
          console.log("Antrian kosong. Istirahat 10 detik...");
          await new Promise((r) => setTimeout(r, 10000));
          continue;
        }
        taskId = task.id;

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
        console.log(`[Queue ID: ${taskId}] Processing...`);

        const data = await composite.scrapeAll(task.target_url);

        // SUKSES:
        data.url = task.target_url;

        // --- LOGIC PEMBUATAN NOTE ---
        let status = "success";
        let note = "Full Detail Scraped";

        // Cek apakah ada log fallback?
        if (data._fallback_logs && data._fallback_logs.length > 0) {
          // Contoh Note: "Used Preview for: experience, education"
          note = `Used Preview (Summary) for: ${data._fallback_logs.join(", ")}`;
        }

        await ProfileRepository.save(data, status, note); // Save Success
        await QueueRepository.updateStatus(taskId, "done");
        console.log(`[Queue ID: ${taskId}] Status -> DONE`);
      } catch (error) {
        console.error(`[Worker Error]:`, error.message);

        // HANDLING KHUSUS JIKA ERROR
        if (taskId) {
          // Jika errornya karena Profil Tidak Ditemukan (404)
          if (error.message === "PROFILE_NOT_FOUND") {
            // Update Queue jadi 'failed' (biar ga nyangkut processing)
            await QueueRepository.updateStatus(
              taskId,
              "failed",
              "Profile not found / 404"
            );

            // Masukkan ke Tabel Profiles sebagai 'not_found' (Sesuai request kamu)
            // Kita kirim objek data kosong cuma isi URL
            await ProfileRepository.save(
              { url: error.url || "unknown" },
              "not_found",
              "Profile URL returned 404/Unavailable"
            );
          } else {
            // Error lain (misal timeout, internet mati, login gagal)
            await QueueRepository.updateStatus(taskId, "failed", error.message);
          }
        }
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
