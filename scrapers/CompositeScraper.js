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
        const data = await scraper.scrape(url);
        console.log(data, `data ${key}`);

        // Jika ini adalah ProfileScraper DAN datanya null (tidak ketemu),
        if (key === "profile") {
          if (!data || !data.name) {
            console.error(
              "!!! Profil tidak valid / 404 / Nama tidak ditemukan. STOP. !!!"
            );
            const err = new Error("PROFILE_NOT_FOUND");
            err.url = url;
            throw err;
          }
        }

        result[key] = data;
      } catch (error) {
        // Jika errornya adalah PROFILE_NOT_FOUND, lempar lagi ke atas (ke Service)
        if (error.message === "PROFILE_NOT_FOUND") {
          throw error;
        }

        // Jika error scraper lain (misal Experience gagal), biarkan saja (set null) & lanjut ke section lain
        console.error(`Gagal scrape bagian ${key}:`, error.message);
        result[key] = null;
      }
    }

    return result;
  }
}

module.exports = CompositeScraper;
