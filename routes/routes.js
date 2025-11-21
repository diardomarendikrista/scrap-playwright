const router = require("express").Router();
const LinkedInController = require("../controllers/LinkedInController");

router.get("/", LinkedInController.getRoot);
router.post("/scrape", LinkedInController.scrape);
router.post("/logout", LinkedInController.logout);

module.exports = router;
