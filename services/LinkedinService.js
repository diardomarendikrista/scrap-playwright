const SessionManager = require("../session/SessionManager");
const CompositeScraper = require("../scrapers/CompositeScraper");
const ProfileRepository = require("../database/ProfileRepository");
const QueueRepository = require("../database/QueueRepository");
const {
  getIdleAccount,
  releaseAccount,
  HOURLY_LIMIT,
} = require("../helpers/getIdleAccount");
const db = require("../config/db");

class LinkedInService {
  async startQueueWorker() {
    console.log("=== WORKER STARTED: Mode Persistent Session ===");

    let isWorkerRunning = true;

    while (isWorkerRunning) {
      let currentEmail = null;
      let browser = null;

      try {
        // 1. CARI AKUN (SQL sudah filter yang limit habis)
        const account = await getIdleAccount();

        if (!account) {
          console.log("⚠️ Semua akun sibuk/limit habis. Menunggu 1 menit...");
          await new Promise((r) => setTimeout(r, 60000));
          continue;
        }

        currentEmail = account.email;

        // Hitung sisa kuota yang boleh diambil sesi ini
        let usage = parseInt(account.hourly_count);

        // GUNAKAN VARIABEL HOURLY_LIMIT (Jangan hardcode 10)
        let sessionQuota = HOURLY_LIMIT - usage + 1;

        // Safety cap: Maksimal scrape dalam 1 sesi browser tidak boleh melebihi sisa limit
        // (Dan mungkin kamu mau batasi max batch browser juga, misal max 10 tab biar gak berat memori)
        const BROWSER_BATCH_LIMIT = 10;
        sessionQuota = Math.min(sessionQuota, BROWSER_BATCH_LIMIT);

        console.log(
          `\n>>> Sesi ${currentEmail} | Limit: ${HOURLY_LIMIT} | Usage DB: ${usage} | Target Sesi: ${sessionQuota} URL`
        );

        // 2. BUKA BROWSER
        browser = await SessionManager.loadBrowser(currentEmail);
        await SessionManager.validateOrLogin(browser, currentEmail);

        const composite = new CompositeScraper(browser);

        // 3. PROSES BATCH
        let processedInSession = 0;

        while (processedInSession < sessionQuota) {
          // Ambil Task
          const task = await QueueRepository.getNextPending();

          if (!task) {
            console.log("Antrian habis! Tutup sesi.");
            break;
          }

          // Jika ini bukan URL pertama di sesi ini, kita wajib lapor increment ke DB
          if (processedInSession > 0) {
            await this.incrementHourlyCount(currentEmail);
          }

          console.log(
            `   [${processedInSession + 1}/${sessionQuota}] ${task.target_url}`
          );
          let taskId = task.id;

          try {
            const data = await composite.scrapeAll(task.target_url);
            data.url = task.target_url;

            let note = "Full Detail Scraped";
            if (data._fallback_logs && data._fallback_logs.length > 0) {
              note = `Summary (Fallback: ${data._fallback_logs.join(", ")})`;
            }

            await ProfileRepository.save(data, "success", note);
            await QueueRepository.updateStatus(taskId, "done");
            console.log(`   -> Done.`);
          } catch (error) {
            console.error(`   -> Error:`, error.message);

            if (error.message === "PROFILE_NOT_FOUND") {
              await QueueRepository.updateStatus(
                taskId,
                "failed",
                "404 / Profile Unavailable"
              );
              await ProfileRepository.save(
                { url: task.target_url },
                "not_found",
                "404 / Unavailable"
              );
            } else {
              await QueueRepository.updateStatus(
                taskId,
                "failed",
                error.message
              );

              if (
                error.message.includes("Target closed") ||
                error.message.includes("Session")
              ) {
                console.log("Browser crash. Restarting session...");
                break;
              }
            }
          }

          processedInSession++;
          // Delay antar profil dalam satu sesi
          await new Promise((r) => setTimeout(r, Math.random() * 3000 + 3000));
        }
      } catch (error) {
        console.error(`[Session Error]:`, error.message);
      } finally {
        // 4. CLEANUP
        if (browser) {
          console.log("Menutup browser...");
          await browser.close();
        }
        if (currentEmail) {
          await releaseAccount(currentEmail);
          console.log(`Akun ${currentEmail} dilepas.`);
        }

        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  // Helper untuk update counter manual di tengah sesi
  async incrementHourlyCount(email) {
    try {
      await db.query(
        `UPDATE accounts SET hourly_count = hourly_count + 1 WHERE email = $1`,
        [email]
      );
    } catch (e) {
      console.error("Gagal update hourly count:", e.message);
    }
  }
}

module.exports = new LinkedInService();
