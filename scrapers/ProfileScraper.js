const BaseScraper = require("./BaseScraper");

class ProfileScraper extends BaseScraper {
  async scrape(url) {
    const page = await this.initPage(url);

    try {
      // --- 1. SAFETY CHECK (404 / Unavailable) ---
      if (page.url().includes("/404") || page.url().includes("unavailable")) {
        console.log("URL 404/Unavailable.");
        await page.close();
        return null;
      }
      const isNotFound = await page.$(
        ".artdeco-empty-state, .not-found__header"
      );
      if (isNotFound) {
        console.log("Elemen 404 terdeteksi.");
        await page.close();
        return null;
      }
      // -------------------------------------------

      await page.waitForSelector("h1", { timeout: 30000 });

      // Scroll ke bawah agar section Experience/Education di bawah ter-render (Lazy Load)
      await this.autoScroll(page);
    } catch (e) {
      console.log("Element profil utama timeout...", e.message);
      // Jika timeout tapi bukan 404, kita coba ambil data yang ada aja
    }

    const data = await page.evaluate(() => {
      const getText = (selector) =>
        document.querySelector(selector)?.innerText?.trim() || null;
      const getSrc = (selector) =>
        document.querySelector(selector)?.src || null;

      // --- LOGIKA LOKASI (ANCHOR STRATEGY) ---
      const getLocation = () => {
        // CARA 1: Cari anchor "Contact info", lalu ambil sibling-nya.
        const contactLink = document.querySelector("a[href*='contact-info']");
        if (contactLink) {
          const container =
            contactLink.closest("div.mt2") ||
            contactLink.parentElement.parentElement;
          if (container) {
            const locSpan = container.querySelector(".text-body-small");
            if (locSpan) return locSpan.innerText.trim();
          }
        }
        // CARA 2: Blacklist Filter
        const potentialElements = document.querySelectorAll(
          ".text-body-small.t-black--light"
        );
        const blackList = [
          "he/him",
          "she/her",
          "they/them",
          "contact info",
          "1st degree",
          "connection",
          "followers",
        ];
        for (const el of potentialElements) {
          const text = el.innerText.trim();
          const lower = text.toLowerCase();
          if (text && !blackList.some((word) => lower.includes(word)))
            return text;
        }
        return null;
      };

      // --- LOGIKA ABOUT ---
      const getAbout = () => {
        return (
          getText(".inline-show-more-text span[aria-hidden='true']") ||
          getText(
            ".inline-show-more-text--is-collapsed span[aria-hidden='true']"
          ) ||
          getText(
            "#about ~ .display-flex .inline-show-more-text span[aria-hidden='true']"
          ) ||
          null
        );
      };

      // LOGIKA BARU (UNTUK MENGAMBIL LIST DARI HALAMAN DEPAN)
      const getSectionData = (anchorId) => {
        const anchor = document.getElementById(anchorId);
        if (!anchor) return [];

        const section = anchor.closest("section");
        if (!section) return [];

        // Selector Agresif: Mencari item list berdasarkan 'data-view-name' atau class list biasa
        // HTML kamu menunjukkan item dibungkus div[data-view-name="profile-component-entity"]
        const entities = section.querySelectorAll(
          'div[data-view-name="profile-component-entity"]'
        );
        const items =
          entities.length > 0
            ? entities
            : section.querySelectorAll(
                "li.artdeco-list__item, li.pvs-list__paged-list-item"
              );

        return [...items]
          .map((el) => {
            // Cari kolom teks vertikal (Flex Column)
            // Logic: Cari div .display-flex.flex-column terdekat di dalam elemen ini
            const textCol = el.querySelector(".display-flex.flex-column");
            if (!textCol) return null;

            // Ambil semua span teks bersih (aria-hidden=true)
            const spans = textCol.querySelectorAll("span[aria-hidden='true']");
            if (spans.length < 1) return null;

            // Mapping berdasarkan urutan baris di halaman depan:
            // Baris 1 (Bold) = Title (ex: Frontend Developer)
            // Baris 2 (Normal) = Subtitle (ex: Daya Dimensi Indonesia)
            // Baris 3 (Gray) = Meta (ex: Jun 2021 - Present)

            const title = spans[0]?.innerText.trim() || null;
            const subtitle = spans[1]?.innerText.trim() || null;
            const meta = spans[2]?.innerText.trim() || null;

            // Ambil deskripsi jika ada (biasanya tersembunyi di tombol see more)
            const descElem =
              el.querySelector(
                ".inline-show-more-text span[aria-hidden='true']"
              ) ||
              el.querySelector(
                ".inline-show-more-text--is-collapsed span[aria-hidden='true']"
              );
            const description = descElem?.innerText.trim() || null;

            return { title, subtitle, meta, description };
          })
          .filter((i) => i && i.title);
      };

      // RETURN DATA GABUNGAN
      return {
        name: getText("h1"),
        headline: getText(".text-body-medium.break-words"),

        location: getLocation(), // Pakai logic lama
        about: getAbout(), // Pakai logic lama

        photo:
          getSrc("img.pv-top-card-profile-picture__image--show") ||
          getSrc("img.pv-top-card-profile-picture__image") ||
          getSrc(".profile-photo-edit__preview"),

        // --- PREVIEW DATA (DATA CADANGAN) ---
        // Ini yang akan dipakai CompositeScraper jika halaman detail kosong
        _preview_experiences: getSectionData("experience"),
        _preview_educations: getSectionData("education"),
        _preview_certifications: getSectionData("licenses_and_certifications"),
        _preview_projects: getSectionData("projects"),
        _preview_skills: getSectionData("skills"),
        _preview_recommendations: getSectionData("recommendations"),
      };
    });

    await page.close();
    return data;
  }
}

module.exports = ProfileScraper;
