const LinkedInService = require("../services/LinkedInService");
const QueueRepository = require("../database/QueueRepository");

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

  // Endpoint: POST /queue/add
  async addToQueue(req, res) {
    try {
      const { urls } = req.body; // Format: [{url: "..."}, {url: "..."}]
      if (!Array.isArray(urls)) return res.status(400).send("Urls harus array");

      const count = await QueueRepository.add(urls);
      res.json({
        success: true,
        message: `${count} URL berhasil masuk antrian.`,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // Endpoint: GET /worker/start (Untuk memicu worker manual)
  async startWorker(req, res) {
    // Jangan pakai await, biarkan dia jalan di background (fire and forget)
    LinkedInService.startQueueWorker().catch(console.error);

    res.json({
      success: true,
      message: "Worker telah dijalankan di background.",
    });
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
