const BaseScraper = require("./BaseScraper");

class SkillScraper extends BaseScraper {
  async scrape(url) {
    const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const skillUrl = `${cleanUrl}/details/skills/`;
    const page = await this.initPage(skillUrl);

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

            // Nama Skill (Bold)
            const nameElem = textCol.querySelector(
              ".t-bold span[aria-hidden='true']"
            );

            // Endorsements (ada di sub-components)
            let endorsements = "0";
            const subComp = el.querySelector(".pvs-entity__sub-components");
            if (subComp) {
              const endoElem = subComp.querySelector(
                ".t-normal.t-black span[aria-hidden='true']"
              );
              if (endoElem && endoElem.innerText.includes("endorsement")) {
                endorsements = endoElem.innerText.trim();
              }
            }

            return {
              name: nameElem ? nameElem.innerText.trim() : null,
              endorsements: endorsements,
            };
          })
          .filter((i) => i !== null && i.name !== null);
      });

      await page.close();
      return data;
    } catch (error) {
      console.log("No skills found.");
      await page.close();
      return [];
    }
  }
}

module.exports = SkillScraper;
