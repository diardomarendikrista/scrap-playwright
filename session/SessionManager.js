const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");

class SessionManager {
  constructor() {
    // Folder khusus untuk menyimpan session banyak akun
    this.sessionsDir = path.join(__dirname, "../../sessions_data");
    if (!fs.existsSync(this.sessionsDir)) fs.mkdirSync(this.sessionsDir);
  }

  /**
   * Helper: Buat path file unik berdasarkan email
   */
  _getPaths(email) {
    // Ubah email jadi nama file yang aman (contoh: budi@gmail.com -> budi_gmail_com)
    const safeName = email.replace(/[^a-z0-9]/gi, "_");
    return {
      sessionFile: path.join(this.sessionsDir, `${safeName}_session.json`),
      profileDir: path.join(this.sessionsDir, `${safeName}_profile`),
    };
  }

  /**
   * Load Browser untuk Email tertentu
   */
  async loadBrowser(email) {
    const { sessionFile, profileDir } = this._getPaths(email);

    // SYNC 1: DB -> LOCAL (Restore Session)
    console.log(`[Session] Cek cookies di DB untuk ${email}...`);
    try {
      const res = await db.query(
        "SELECT cookies FROM accounts WHERE email = $1",
        [email]
      );

      if (res.rows.length > 0 && res.rows[0].cookies) {
        // Jika DB punya cookies, kita timpa file lokal
        fs.writeFileSync(
          sessionFile,
          JSON.stringify(res.rows[0].cookies, null, 2)
        );
        console.log(`[Session] Cookies lokal diperbarui dari DB.`);
      } else {
        console.log(`[Session] Belum ada cookies di DB.`);
      }
    } catch (err) {
      console.error(`[Session Warning] Gagal sync cookies: ${err.message}`);
    }
    // ---------------------------------------------

    const hasSession = fs.existsSync(sessionFile);

    console.log(`[Browser] Memuat profil di: ${profileDir}`);

    const context = await chromium.launchPersistentContext(profileDir, {
      headless: false, // Ubah jadi true jika di server linux
      storageState: hasSession ? sessionFile : undefined,
      viewport: { width: 1280, height: 720 },
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-infobars",
        "--ignore-certificate-errors",
        "--disable-extensions",
        "--disable-gpu",
      ],
    });

    return context;
  }

  /**
   * Simpan session (cookies) ke Local DAN Database
   */
  async saveSessionToDb(context, email) {
    try {
      const cookies = await context.storageState();
      const { sessionFile } = this._getPaths(email);

      // Simpan ke Local File (Backup fisik)
      fs.writeFileSync(sessionFile, JSON.stringify(cookies, null, 2));

      // Simpan ke Database (Untuk worker lain)
      const query = `
        UPDATE accounts 
        SET cookies = $1, last_used = NOW() 
        WHERE email = $2
      `;
      await db.query(query, [JSON.stringify(cookies), email]);

      console.log(
        `[DB Sync] Cookies berhasil disimpan ke DB & Local untuk ${email}`
      );
    } catch (err) {
      console.error(`[DB Error] Gagal menyimpan session: ${err.message}`);
    }
  }

  /**
   * Validasi Login
   */
  async validateOrLogin(context, email) {
    const page = await context.newPage();
    console.log(`[Auth] Mengecek sesi untuk ${email}...`);

    try {
      await page.goto("https://www.linkedin.com/feed/", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    } catch (e) {
      console.log("Navigasi feed timeout, cek login...");
    }

    // Cek indikator logout
    const isLoginPage =
      page.url().includes("login") ||
      (await page.$("#username")) ||
      (await page.$(".login__form_action_container"));

    if (isLoginPage) {
      console.log(`[Auth] Sesi mati. Mengambil password dari DB...`);

      // Ambil Password dari DB
      const res = await db.query(
        "SELECT password FROM accounts WHERE email = $1",
        [email]
      );
      if (res.rows.length === 0) {
        throw new Error(`Akun ${email} tidak ditemukan di database!`);
      }
      const { password } = res.rows[0];

      // Proses Login
      console.log("Melakukan login otomatis...");
      await page.goto("https://www.linkedin.com/login");
      await page.fill("#username", email);
      await page.fill("#password", password);
      await page.click("button[type='submit']");

      await page.waitForURL("**/feed/**", { timeout: 60000 });
      console.log("[Auth] Login sukses!");

      // Simpan Cookies Baru
      await this.saveSessionToDb(context, email);
    } else {
      console.log("[Auth] Sesi masih valid.");

      // PENTING: Walaupun sesi valid, tetap update DB biar worker lain tau cookies terbaru
      await this.saveSessionToDb(context, email);
    }

    await page.close();
  }

  // Hapus Session Lokal (Opsional)
  async clearSession(email) {
    const { sessionFile, profileDir } = this._getPaths(email);
    try {
      if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
      if (fs.existsSync(profileDir))
        fs.rmSync(profileDir, { recursive: true, force: true });
      console.log(`Session lokal ${email} dihapus.`);
      return true;
    } catch (error) {
      console.error("Gagal menghapus sesi:", error);
      return false;
    }
  }
}

module.exports = new SessionManager();
