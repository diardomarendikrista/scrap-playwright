const BaseScraper = require("./BaseScraper");

class ExperienceScraper extends BaseScraper {
  async scrape(url) {
    const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const expUrl = `${cleanUrl}/details/experience/`;
    const page = await this.initPage(expUrl);

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
        const results = [];

        items.forEach((el) => {
          const textCol = el.querySelector(".display-flex.flex-column");
          if (!textCol) return;

          // 1. Title & Company & Period (Logic Class CSS)
          const titleElem =
            textCol.querySelector(".mr1 span[aria-hidden='true']") ||
            textCol.querySelector(".t-bold span[aria-hidden='true']");

          const companyElem = textCol.querySelector(
            ".t-normal:not(.t-black--light) span[aria-hidden='true']"
          );

          const metaElems = textCol.querySelectorAll(
            ".t-black--light span[aria-hidden='true']"
          );
          let period = null;
          let location = null;
          if (metaElems.length > 0) period = metaElems[0]?.innerText.trim();
          if (metaElems.length > 1) location = metaElems[1]?.innerText.trim();

          // 2. DESCRIPTION & SKILLS (Fix dari Snippet)
          // Deskripsi ada di dalam 'pvs-entity__sub-components'.
          // Kita cari semua teks hitam normal (.t-14.t-normal.t-black) di dalam sub-components.
          let descriptionParts = [];

          // Cari container sub-component di dalam item ini
          const subComponents = el.querySelectorAll(
            ".pvs-entity__sub-components .t-14.t-normal.t-black span[aria-hidden='true']"
          );

          subComponents.forEach((desc) => {
            const txt = desc.innerText.trim();
            if (txt) descriptionParts.push(txt);
          });

          // Gabungkan deskripsi dan skills dengan baris baru
          const description =
            descriptionParts.length > 0 ? descriptionParts.join("\n\n") : null;

          // Filter Sampah
          const titleText = titleElem?.innerText.trim();
          if (!titleText) return;
          if (period && (period.includes("3rd+") || period.includes("1st")))
            return;

          results.push({
            title: titleText,
            company: companyElem?.innerText.trim() || null,
            period: period,
            location: location,
            description: description,
          });
        });

        return results;
      });

      await page.close();
      return data;
    } catch (error) {
      console.error("Error scraping Experience:", error.message);
      await page.close();
      return [];
    }
  }
}

module.exports = ExperienceScraper;
