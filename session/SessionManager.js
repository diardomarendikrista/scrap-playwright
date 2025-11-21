// src/session/SessionManager.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

class SessionManager {
  constructor() {
    this.sessionFile = path.join(__dirname, "linkedinSession.json");
    this.profileDir = path.join(__dirname, "profile");
  }

  async loadBrowser() {
    const hasSession = fs.existsSync(this.sessionFile);

    const context = await chromium.launchPersistentContext(this.profileDir, {
      headless: false,
      storageState: hasSession ? this.sessionFile : undefined,
      viewport: { width: 1280, height: 720 },
      args: [
        "--disable-blink-features=AutomationControlled", // Sembunyikan indikasi bot
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-infobars",
        "--window-position=0,0",
        "--ignore-certificate-errors",
        "--disable-extensions",
        "--disable-gpu", // Kadang GPU bikin crash di environment tertentu
      ],
    });

    return context;
  }

  /**
   * Mengecek apakah login diperlukan. Jika ya, lakukan login via ENV.
   * @param {import('playwright').BrowserContext} context
   */
  async validateOrLogin(context) {
    const page = await context.newPage();

    console.log("Mengecek status sesi...");
    await page.goto("https://www.linkedin.com/feed/", {
      waitUntil: "domcontentloaded",
    });

    // Cek apakah di-redirect ke halaman login atau ada tombol sign-in
    if (
      page.url().includes("login") ||
      (await page.$("#username")) ||
      (await page.$(".login__form_action_container"))
    ) {
      console.log("Sesi kadaluarsa/tidak ada. Melakukan Auto-Login...");

      const email = process.env.LINKEDIN_EMAIL;
      const password = process.env.LINKEDIN_PASSWORD;

      if (!email || !password) {
        throw new Error(
          "Kredensial LINKEDIN_EMAIL atau LINKEDIN_PASSWORD belum diset di .env"
        );
      }

      // Navigasi eksplisit ke halaman login yang bersih
      await page.goto("https://www.linkedin.com/login");

      // Isi form
      await page.fill("#username", email);
      await page.fill("#password", password);

      console.log("Submit login...");
      await page.click("button[type='submit']");

      // Tunggu sampai masuk ke feed (indikator sukses)
      try {
        await page.waitForURL("**/feed/**", { timeout: 30000 });
        console.log("Login berhasil!");

        // Simpan sesi baru dan next pakai ini dan tidak login ulang
        await this.saveSession(context);
      } catch (e) {
        console.error(
          "Gagal login atau butuh verifikasi manual (CAPTCHA/OTP)."
        );
        // Jangan throw error di sini jika ingin membiarkan user intervensi manual di mode headless:false
      }
    } else {
      console.log("Sesi masih valid.");
    }

    await page.close();
  }

  async saveSession(context) {
    const storage = await context.storageState();
    fs.writeFileSync(this.sessionFile, JSON.stringify(storage, null, 2));
    console.log("Sesi disimpan ke linkedinSession.json");
  }

  async clearSession() {
    try {
      // Hapus file JSON session
      if (fs.existsSync(this.sessionFile)) {
        fs.unlinkSync(this.sessionFile);
        console.log("File sesi dihapus.");
      }

      // Hapus folder profile (hapus isinya biar benar-benar bersih)
      if (fs.existsSync(this.profileDir)) {
        fs.rmSync(this.profileDir, { recursive: true, force: true });
        console.log("Folder profile dibersihkan.");
      }

      return true;
    } catch (error) {
      console.error("Gagal menghapus sesi:", error);
      return false;
    }
  }
}

module.exports = new SessionManager();
