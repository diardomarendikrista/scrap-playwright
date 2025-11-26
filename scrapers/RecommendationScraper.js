const BaseScraper = require("./BaseScraper");

class RecommendationScraper extends BaseScraper {
  async scrape(url) {
    const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const recUrl = `${cleanUrl}/details/recommendations/?detailScreenTabIndex=0`;
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
            // Ambil nama dari .t-bold span
            const nameSpan = el.querySelector(
              ".t-bold span[aria-hidden='true']"
            );
            const name = nameSpan ? nameSpan.innerText.trim() : null;

            // Ambil relation dari .pvs-entity__caption-wrapper
            const relationSpan = el.querySelector(
              ".pvs-entity__caption-wrapper[aria-hidden='true']"
            );
            const relation = relationSpan
              ? relationSpan.innerText.trim()
              : null;

            // Ambil text rekomendasi dari .pvs-entity__sub-components
            const descElem = el.querySelector(
              ".pvs-entity__sub-components .t-14.t-normal.t-black span[aria-hidden='true']"
            );
            const text = descElem ? descElem.innerText.trim() : null;

            return {
              name,
              relation,
              text,
            };
          })
          .filter((i) => i !== null && i.text !== null);
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
