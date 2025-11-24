const BaseScraper = require("./BaseScraper");

class ProjectScraper extends BaseScraper {
  async scrape(url) {
    const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const projectUrl = `${cleanUrl}/details/projects/`;
    const page = await this.initPage(projectUrl);

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

            // Deskripsi ada di sub-component
            const descParts = [];
            const subComps = el.querySelectorAll(
              ".pvs-entity__sub-components .t-black span[aria-hidden='true']"
            );
            subComps.forEach((s) => {
              // Hindari mengambil teks tombol "Show project"
              if (s.innerText !== "Show project")
                descParts.push(s.innerText.trim());
            });

            // Link Project
            const projectLink = el.querySelector(
              "a[href^='http']:not([href*='linkedin.com'])"
            );

            return {
              title: spans[0] ? spans[0].innerText.trim() : null,
              period: spans[1] ? spans[1].innerText.trim() : null, // Contoh: Jun 2021 - Present
              description: descParts.join("\n"),
              url: projectLink ? projectLink.href : null,
            };
          })
          .filter((i) => i !== null);
      });

      await page.close();
      return data;
    } catch (error) {
      console.log("No projects found.");
      await page.close();
      return [];
    }
  }
}

module.exports = ProjectScraper;
