const BaseScraper = require("./BaseScraper");

class EducationScraper extends BaseScraper {
  async scrape(url) {
    const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const eduUrl = `${cleanUrl}/details/education/`;
    const page = await this.initPage(eduUrl);

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

          // School Name
          const schoolElem =
            textCol.querySelector(".mr1 span[aria-hidden='true']") ||
            textCol.querySelector(".t-bold span[aria-hidden='true']");

          // Degree (Normal text, not gray)
          const degreeElem = textCol.querySelector(
            ".t-normal:not(.t-black--light) span[aria-hidden='true']"
          );

          // Years/Field (Gray text)
          const metaElems = textCol.querySelectorAll(
            ".t-black--light span[aria-hidden='true']"
          );
          let field = null;
          if (metaElems.length > 0) field = metaElems[0]?.innerText.trim();

          // Grade
          // Cari di sub-components, tapi FILTER teksnya
          let grade = null;
          const subProps = el.querySelectorAll(
            ".pvs-entity__sub-components .t-14.t-normal.t-black span[aria-hidden='true']"
          );

          subProps.forEach((prop) => {
            const txt = prop.innerText.trim();
            const lowerTxt = txt.toLowerCase();

            // HANYA ambil jika mengandung kata kunci nilai
            if (
              lowerTxt.includes("grade")
              // lowerTxt.includes("gpa") ||
              // lowerTxt.includes("ipk") ||
              // lowerTxt.includes("score")
            ) {
              grade = txt;
            }
          });

          const schoolName = schoolElem?.innerText.trim();
          if (!schoolName) return;

          results.push({
            school: schoolName,
            degree: degreeElem?.innerText.trim() || null,
            field: field,
            grade: grade, // Sekarang akan null jika tidak ada keyword Grade
          });
        });

        return results;
      });

      await page.close();
      return data;
    } catch (error) {
      console.error("Error scraping Education:", error.message);
      await page.close();
      return [];
    }
  }
}

module.exports = EducationScraper;
