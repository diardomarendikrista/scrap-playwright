const LinkedInService = require("../services/LinkedInService");

class LinkedInController {
  async getRoot(req, res) {
    res.json({ success: true, message: "Welcome to LinkedIn Scraper API" });
  }

  async scrape(req, res) {
    try {
      // Terima request body, bisa berupa { url: "..." } atau { urls: ["...", "..."] }
      const { urls } = req.body;

      // Validasi input harus array
      if (!Array.isArray(urls)) {
        return res.status(400).json({
          success: false,
          message: "Input 'urls' harus berupa array.",
        });
      }

      const data = await LinkedInService.scrapeProfiles(urls);

      res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async logout(req, res) {
    try {
      await SessionManager.clearSession();
      res.json({
        success: true,
        message: "Logout berhasil. Sesi dan profile lokal telah dihapus.",
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new LinkedInController();
