const ProfileScraper = require("./ProfileScraper");
const ExperienceScraper = require("./ExperienceScraper");
const EducationScraper = require("./EducationScraper");
const CertificationScraper = require("./CertificationScraper");
const ProjectScraper = require("./ProjectScraper");
const SkillScraper = require("./SkillScraper");
const RecommendationScraper = require("./RecommendationScraper");

class CompositeScraper {
  constructor(browser) {
    this.browser = browser;

    this.scrapers = [
      new ProfileScraper(browser),
      new ExperienceScraper(browser),
      new EducationScraper(browser),
      new CertificationScraper(browser),
      new ProjectScraper(browser),
      new SkillScraper(browser),
      new RecommendationScraper(browser),
    ];
  }

  async scrapeAll(url) {
    const result = {
      _fallback_logs: [], // <--- TEMPAT MENYIMPAN CATATAN FALLBACK
    };
    let profilePreviews = {};

    for (const scraper of this.scrapers) {
      // Mengambil nama key dari nama class.
      const key = scraper.constructor.name.replace("Scraper", "").toLowerCase();
      console.log(`--- Scraping ${key} section ---`);

      // Jalankan scrape per bagian
      try {
        const data = await scraper.scrape(url);

        // --- 1. HANDLE PROFILE & PREVIEWS ---
        if (key === "profile") {
          if (!data || !data.name) {
            console.error("!!! Profil tidak valid / 404. STOP. !!!");
            const err = new Error("PROFILE_NOT_FOUND");
            err.url = url;
            throw err;
          }

          // Pisahkan data preview dari data utama
          const {
            _preview_experiences,
            _preview_educations,
            _preview_certifications,
            _preview_projects,
            _preview_skills,
            _preview_recommendations,
            ...mainProfile
          } = data;

          // Simpan ke memori sementara
          profilePreviews = {
            experience: _preview_experiences,
            education: _preview_educations,
            certification: _preview_certifications,
            project: _preview_projects,
            skill: _preview_skills,
            recommendation: _preview_recommendations,
          };

          result[key] = mainProfile; // Simpan profile yang bersih
          continue; // Lanjut ke loop berikutnya
        }

        // 2. Handle Section Lain (LOGIC FALLBACK + CATAT NOTE)
        // Jika hasil scrape detail KOSONG (null atau array kosong)
        if (
          (!data || (Array.isArray(data) && data.length === 0)) &&
          profilePreviews[key] &&
          profilePreviews[key].length > 0
        ) {
          console.warn(
            `[Fallback] Section ${key} kosong/gagal. Menggunakan data preview halaman depan.`
          );

          // Format ulang data preview agar mirip dengan struktur DB
          result[key] = this.mapPreviewToSchema(key, profilePreviews[key]);

          // --- TAMBAHKAN CATATAN KE LOG ---
          result._fallback_logs.push(key);
        } else {
          // Jika sukses scrape detail, pakai itu
          result[key] = data;
        }
      } catch (error) {
        if (error.message === "PROFILE_NOT_FOUND") throw error;

        console.error(
          `Gagal scrape bagian ${key}, mencoba fallback...`,
          error.message
        );

        // Jika error, coba pakai preview sebagai opsi terakhir
        if (profilePreviews[key]) {
          result[key] = this.mapPreviewToSchema(key, profilePreviews[key]);
        } else {
          result[key] = null;
        }
      }
    }

    return result;
  }

  // Helper: Ubah format Preview (Title/Subtitle) jadi format DB (Company/School/dll)
  mapPreviewToSchema(key, previewData) {
    if (!Array.isArray(previewData)) return [];

    return previewData.map((item) => {
      // Mapping generik
      const mapped = {
        title: item.title,
        description: item.description,
      };

      if (key === "experience") {
        mapped.company = item.subtitle;
        mapped.period = item.meta;
      } else if (key === "education") {
        mapped.school = item.title; // Di preview title biasanya nama sekolah
        mapped.degree = item.subtitle;
        mapped.field = item.meta; // Tahun biasanya di meta
      } else if (key === "certification") {
        mapped.issuer = item.subtitle;
        mapped.issued_date = item.meta;
      } else if (key === "project") {
        mapped.period = item.meta;
      } else if (key === "skill") {
        mapped.name = item.title;
        mapped.endorsements = item.subtitle; // Kadang endorsement ada di subtitle
      } else if (key === "recommendation") {
        mapped.name = item.title;
        mapped.text = item.description;
      }

      return mapped;
    });
  }
}

module.exports = CompositeScraper;
