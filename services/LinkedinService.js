// src/services/LinkedInService.js
const SessionManager = require("../session/SessionManager");
const ProfileScraper = require("../scrapers/ProfileScraper");
const ExperienceScraper = require("../scrapers/ExperienceScraper");
const EducationScraper = require("../scrapers/EducationScraper");
const CompositeScraper = require("../scrapers/CompositeScraper");

class LinkedInService {
  async scrapeProfiles(urlList) {
    // Load Browser
    const browser = await SessionManager.loadBrowser();

    try {
      // Pastikan Login dulu sebelum scraping
      await SessionManager.validateOrLogin(browser);

      const results = [];
      const composite = new CompositeScraper(browser, [
        new ProfileScraper(browser),
        new ExperienceScraper(browser),
        new EducationScraper(browser),
      ]);

      // Mulai Looping
      for (const item of urlList) {
        const url = item.url;
        console.log(`Scraping: ${url}`);

        try {
          const data = await composite.scrapeAll(url);
          results.push({ url, status: "success", data });
        } catch (e) {
          console.error(`Gagal scrape ${url}:`, e.message);
          results.push({ url, status: "failed", error: e.message });
        }

        // Delay agar human-like
        await new Promise((r) => setTimeout(r, Math.random() * 4000 + 3000));
      }

      return results;
    } catch (error) {
      throw error;
    } finally {
      // Tutup browser
      await browser.close();
    }
  }
}

module.exports = new LinkedInService();
