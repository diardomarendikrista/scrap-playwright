const ProfileScraper = require("./ProfileScraper");
const ExperienceScraper = require("./ExperienceScraper");
const EducationScraper = require("./EducationScraper");
const CertificationScraper = require("./CertificationScraper");
const ProjectScraper = require("./ProjectScraper");
const SkillScraper = require("./SkillScraper");
const RecommendationScraper = require("./RecommendationScraper");

class CompositeScraper {
  constructor(browser) {
    this.browser = browser;

    this.scrapers = [
      new ProfileScraper(browser),
      new ExperienceScraper(browser),
      new EducationScraper(browser),
      new CertificationScraper(browser),
      new ProjectScraper(browser),
      new SkillScraper(browser),
      new RecommendationScraper(browser),
    ];
  }

  async scrapeAll(url) {
    const result = {};

    for (const scraper of this.scrapers) {
      // Mengambil nama key dari nama class.
      const key = scraper.constructor.name.replace("Scraper", "").toLowerCase();

      console.log(`--- Scraping ${key} section ---`); // Log biar enak dilihat

      // Jalankan scrape per bagian
      try {
        result[key] = await scraper.scrape(url);
      } catch (error) {
        console.error(`Gagal scrape bagian ${key}:`, error.message);
        result[key] = null; // Kalau gagal, set null biar tidak crash semua
      }
    }

    return result;
  }
}

module.exports = CompositeScraper;
