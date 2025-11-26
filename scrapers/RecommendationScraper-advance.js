const BaseScraper = require("./BaseScraper");

class RecommendationScraper extends BaseScraper {
  async scrape(url) {
    const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const recUrl = `${cleanUrl}/details/recommendations/?detailScreenTabIndex=0`;
    let page;

    try {
      page = await this.initPage(recUrl);
      await page.waitForSelector("main", { timeout: 10000 });
      await this.autoScroll(page);

      const data = await page.evaluate(() => {
        const items = document.querySelectorAll("li.pvs-list__paged-list-item");

        if (items.length === 0) {
          console.log("No recommendation items found");
          return [];
        }

        return [...items]
          .map((el, index) => {
            try {
              const name = this.extractName(el);
              const relation = this.extractRelation(el);
              const text = this.extractText(el);

              return {
                index,
                name,
                relation,
                text,
              };
            } catch (err) {
              console.error(`Error processing item ${index}:`, err.message);
              return null;
            }
          })
          .filter((i) => i !== null && i.text !== null && i.text.length > 20);
      });

      console.log(`Success scrape ${data.length} recommendations`);

      // Log incomplete data untuk monitoring
      data.forEach((rec) => {
        if (!rec.name) {
          console.warn(`⚠ Missing name on index ${rec.index}`);
        }
        if (!rec.relation) {
          console.warn(`⚠ Missing relation on index ${rec.index}`);
        }
      });

      await page.close();
      return data;
    } catch (error) {
      console.error("Error scraping recommendations:", error.message);
      if (page) await page.close();
      return [];
    }
  }

  /**
   * Extract nama dengan multiple fallback strategies
   */
  extractName(el) {
    // Strategy 1: .t-bold span[aria-hidden='true']
    let nameSpan = el.querySelector(".t-bold span[aria-hidden='true']");
    if (nameSpan) {
      const name = nameSpan.innerText?.trim();
      if (name && name.length > 0) return name;
    }

    // Strategy 2: .hoverable-link-text span
    nameSpan = el.querySelector(
      ".hoverable-link-text span[aria-hidden='true']"
    );
    if (nameSpan) {
      const name = nameSpan.innerText?.trim();
      if (name && name.length > 0) return name;
    }

    // Strategy 3: First link dengan href=/in/
    const link = el.querySelector("a[href*='/in/']");
    if (link) {
      const href = link.getAttribute("href");
      if (href) {
        const username = href.split("/in/")[1]?.split("?")[0];
        if (username) return username;
      }
    }

    // Strategy 4: Cari span text paling pendek di awal (biasanya nama)
    const spans = el.querySelectorAll("span[aria-hidden='true']");
    for (let span of spans) {
      const txt = span.innerText?.trim();
      if (txt && txt.length > 0 && txt.length < 50 && !txt.includes(" ")) {
        return txt;
      }
    }

    // Strategy 5: Ambil dari alt text image
    const img = el.querySelector("img[alt]");
    if (img) {
      const alt = img.getAttribute("alt");
      if (alt && alt !== "Profile photo") return alt;
    }

    return null;
  }

  /**
   * Extract relation dengan multiple fallback strategies
   */
  extractRelation(el) {
    // Strategy 1: .pvs-entity__caption-wrapper[aria-hidden='true']
    let relationSpan = el.querySelector(
      ".pvs-entity__caption-wrapper[aria-hidden='true']"
    );
    if (relationSpan) {
      const relation = relationSpan.innerText?.trim();
      if (relation && relation.length > 5) return relation;
    }

    // Strategy 2: .t-normal.t-black--light span
    relationSpan = el.querySelector(
      ".t-normal.t-black--light span[aria-hidden='true']"
    );
    if (relationSpan) {
      const relation = relationSpan.innerText?.trim();
      if (relation && relation.length > 5) return relation;
    }

    // Strategy 3: Cari span dengan kata kunci "worked", "collaborated", dll
    const spans = el.querySelectorAll("span[aria-hidden='true']");
    for (let span of spans) {
      const txt = span.innerText?.trim();
      if (
        txt &&
        (txt.includes("worked") ||
          txt.includes("collaborated") ||
          txt.includes("team") ||
          txt.includes("2022") ||
          txt.includes("2023") ||
          txt.includes("2024"))
      ) {
        if (txt.length > 10 && txt.length < 200) return txt;
      }
    }

    // Strategy 4: Cari dari .pvs-entity__sub-components caption
    relationSpan = el.querySelector(
      ".pvs-entity__sub-components .t-black--light span[aria-hidden='true']"
    );
    if (relationSpan) {
      const relation = relationSpan.innerText?.trim();
      if (relation && relation.length > 5) return relation;
    }

    return null;
  }

  /**
   * Extract recommendation text dengan multiple fallback strategies
   */
  extractText(el) {
    // Strategy 1: .pvs-entity__sub-components .t-14.t-normal.t-black span
    let descElem = el.querySelector(
      ".pvs-entity__sub-components .t-14.t-normal.t-black span[aria-hidden='true']"
    );
    if (descElem) {
      const text = descElem.innerText?.trim();
      if (text && text.length > 20) return text;
    }

    // Strategy 2: .inline-show-more-text span
    descElem = el.querySelector(
      ".inline-show-more-text span[aria-hidden='true']"
    );
    if (descElem) {
      const text = descElem.innerText?.trim();
      if (text && text.length > 20) return text;
    }

    // Strategy 3: Cari semua span dan ambil yang paling panjang (>50 char, <5000 char)
    const spans = el.querySelectorAll("span[aria-hidden='true']");
    let longestText = null;
    let maxLength = 0;

    for (let span of spans) {
      const txt = span.innerText?.trim();
      if (
        txt &&
        txt.length > 20 &&
        txt.length < 5000 &&
        txt.length > maxLength &&
        !txt.includes("worked") && // Jangan ambil relation text
        !txt.includes("First degree") &&
        !txt.includes("·")
      ) {
        longestText = txt;
        maxLength = txt.length;
      }
    }

    if (longestText) return longestText;

    // Strategy 4: Cari dari .pvs-entity__sub-components secara umum
    const subComp = el.querySelector(".pvs-entity__sub-components");
    if (subComp) {
      const allText = subComp.innerText?.trim();
      if (allText && allText.length > 20 && allText.length < 5000) {
        return allText;
      }
    }

    return null;
  }
}

module.exports = RecommendationScraper;
