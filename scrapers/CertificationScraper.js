const BaseScraper = require("./BaseScraper");

class CertificationScraper extends BaseScraper {
  async scrape(url) {
    const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const certUrl = `${cleanUrl}/details/certifications/`;
    const page = await this.initPage(certUrl);

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

            // Link Sertifikat (biasanya tombol "Show credential")
            const linkAnchor = el.querySelector(
              "a[href*='google.com'], a[href*='udemy.com'], a[href*='bit.ly']"
            );
            // Atau cari tombol action generic
            const genericLink = el.querySelector(
              ".pvs-entity__sub-components a.optional-action-target-wrapper"
            );

            return {
              title: spans[0] ? spans[0].innerText.trim() : null,
              issuer: spans[1] ? spans[1].innerText.trim() : null, // Contoh: Udemy, Hacktiv8
              issued_date: spans[2] ? spans[2].innerText.trim() : null, // Contoh: Issued Dec 2024
              credential_id: spans[3]
                ? spans[3].innerText.replace("Credential ID ", "").trim()
                : null,
              url: linkAnchor
                ? linkAnchor.href
                : genericLink
                  ? genericLink.href
                  : null,
            };
          })
          .filter((i) => i !== null);
      });

      await page.close();
      return data;
    } catch (error) {
      // Certifications bersifat opsional, kalau tidak ada jangan error, return kosong saja
      console.log("No certifications found or error accessing page.");
      await page.close();
      return [];
    }
  }
}

module.exports = CertificationScraper;
