const router = require("express").Router();
const LinkedInController = require("../controllers/LinkedInController");

router.get("/", LinkedInController.getRoot);

router.post("/scrape", LinkedInController.scrape);
router.post("/queue/add", LinkedInController.addToQueue);
router.get("/worker/start", LinkedInController.startWorker);

router.post("/logout", LinkedInController.logout);

module.exports = router;
