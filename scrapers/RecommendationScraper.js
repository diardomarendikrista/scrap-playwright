const BaseScraper = require("./BaseScraper");

class RecommendationScraper extends BaseScraper {
  async scrape(url) {
    const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const recUrl = `${cleanUrl}/details/recommendations/?detailScreenTabIndex=0`; // Tab 0 = Received
    const page = await this.initPage(recUrl);

    try {
      await page.waitForSelector("main", { timeout: 10000 });
      await this.autoScroll(page);

      const data = await page.evaluate(() => {
        const container = document.querySelector(
          ".scaffold-finite-scroll__content"
        );
        if (!container) return [];
        const items = container.querySelectorAll(
          "li.pvs-list__paged-list-item"
        );

        return [...items]
          .map((el) => {
            const textCol = el.querySelector(".display-flex.flex-column");
            if (!textCol) return null;

            const spans = textCol.querySelectorAll("span[aria-hidden='true']");

            // Text rekomendasi ada di sub-component -> inline-show-more-text
            const descElem = el.querySelector(
              ".inline-show-more-text span[aria-hidden='true']"
            );

            return {
              name: spans[0] ? spans[0].innerText.trim() : null, // Nama Pemberi
              relation: spans[2] ? spans[2].innerText.trim() : null, // Hubungan (misal: worked with...)
              text: descElem ? descElem.innerText.trim() : null,
            };
          })
          .filter((i) => i !== null);
      });

      await page.close();
      return data;
    } catch (error) {
      console.log("No recommendations found.");
      await page.close();
      return [];
    }
  }
}

module.exports = RecommendationScraper;
