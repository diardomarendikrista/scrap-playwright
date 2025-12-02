const BaseScraper = require("./BaseScraper");

class ProfileScraper extends BaseScraper {
  async scrape(url) {
    const page = await this.initPage(url);

    try {
      await page.waitForSelector("h1", { timeout: 15000 });
      // Scroll agar elemen header ter-render sempurna
      await page.keyboard.press("PageDown");
      await this.randomDelay(page, 1000, 2000);
    } catch (e) {
      console.log("Element profil utama timeout...");
    }

    const data = await page.evaluate(() => {
      const getText = (selector) =>
        document.querySelector(selector)?.innerText?.trim() || null;
      const getSrc = (selector) =>
        document.querySelector(selector)?.src || null;

      // --- LOGIKA LOKASI (ANCHOR STRATEGY) ---
      const getLocation = () => {
        // CARA 1: Cari anchor "Contact info", lalu ambil sibling-nya.
        // Ini cara paling akurat karena lokasi selalu satu grup dengan Contact Info.
        const contactLink = document.querySelector("a[href*='contact-info']");

        if (contactLink) {
          // Struktur HTML:
          // <div class="mt2 ...">  <-- Container
          //    <span>Lokasi</span>
          //    <span><a>Contact info</a></span>
          // </div>

          // Kita cari parent DIV terdekat yang membungkus contact info
          const container =
            contactLink.closest("div.mt2") ||
            contactLink.parentElement.parentElement;

          if (container) {
            // Cari elemen text-body-small di dalam container yang SAMA
            const locSpan = container.querySelector(".text-body-small");
            if (locSpan) return locSpan.innerText.trim();
          }
        }

        // CARA 2 (Fallback): Blacklist Filter
        // Jika Cara 1 gagal, cari semua elemen yang "mirip" lokasi lalu filter kata terlarang.
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
          const isBanned = blackList.some((word) => lower.includes(word));

          // Jika text ada isinya, dan tidak mengandung kata terlarang -> AMBIL
          if (text && !isBanned) return text;
        }

        return null;
      };

      return {
        name: getText("h1"),

        headline: getText(".text-body-medium.break-words"),

        // Panggil fungsi lokasi yang baru
        location: getLocation(),

        about:
          getText(".inline-show-more-text span[aria-hidden='true']") ||
          getText(
            ".inline-show-more-text--is-collapsed span[aria-hidden='true']"
          ) ||
          getText(
            "#about ~ .display-flex .inline-show-more-text span[aria-hidden='true']"
          ) ||
          null,

        // PERBAIKAN FOTO:
        // Menambahkan selector spesifik dari snippet kamu (--show)
        photo:
          getSrc("img.pv-top-card-profile-picture__image--show") ||
          getSrc("img.pv-top-card-profile-picture__image") ||
          getSrc(".profile-photo-edit__preview"),
      };
    });

    await page.close();
    return data;
  }
}

module.exports = ProfileScraper;
