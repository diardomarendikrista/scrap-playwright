class CompositeScraper {
  constructor(browser, scrapers = []) {
    this.browser = browser;
    this.scrapers = scrapers;
  }

  async scrapeAll(url) {
    const result = {};

    for (const scraper of this.scrapers) {
      const key = scraper.constructor.name.replace("Scraper", "").toLowerCase();
      result[key] = await scraper.scrape(url);
    }

    return result;
  }
}

module.exports = CompositeScraper;
