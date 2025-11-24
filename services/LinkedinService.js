// src/services/LinkedInService.js
const SessionManager = require("../session/SessionManager");
const CompositeScraper = require("../scrapers/CompositeScraper");

class LinkedInService {
  async scrapeProfiles(urlList) {
    const browser = await SessionManager.loadBrowser();

    try {
      await SessionManager.validateOrLogin(browser);
      const results = [];

      const composite = new CompositeScraper(browser);

      for (const item of urlList) {
        const url = item.url;
        console.log(`\n=== Mulai Scraping Profile: ${url} ===`);

        try {
          const data = await composite.scrapeAll(url);
          results.push({ url, status: "success", data });
        } catch (e) {
          console.error(`CRITICAL ERROR scrape ${url}:`, e.message);
          results.push({ url, status: "failed", error: e.message });
        }

        // Delay antar profile
        await new Promise((r) => setTimeout(r, Math.random() * 4000 + 3000));
      }

      return results;
    } catch (error) {
      throw error;
    } finally {
      await browser.close();
    }
  }
}

module.exports = new LinkedInService();
