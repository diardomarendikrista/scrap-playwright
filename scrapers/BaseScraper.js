class BaseScraper {
  constructor(browser) {
    this.browser = browser;
  }

  async initPage(url) {
    const page = await this.browser.newPage();

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    console.log(`Navigating to: ${url}`);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

      // Random delay awal
      await this.randomDelay(page, 2000, 4000);
    } catch (error) {
      console.error(`Gagal membuka page ${url}:`, error.message);
      await page.close();
      throw error;
    }

    return page;
  }

  // Reusable randomDelay buat Scraper lain
  async randomDelay(page, min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await page.waitForTimeout(delay);
  }

  // Keyboard Press agar visual scroll & trigger lazy load
  async autoScroll(page) {
    console.log("Scrolling.. (human-like behavior)");

    // Tekan PageDown beberapa kali
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("PageDown");
      // Tunggu sebentar setiap kali tekan tombol (biar seperti orang membaca)
      await page.waitForTimeout(Math.random() * 1000 + 500);
    }

    // Tekan End untuk memastikan sampai paling bawah
    await page.keyboard.press("End");
    await page.waitForTimeout(2000);
  }
}

module.exports = BaseScraper;
