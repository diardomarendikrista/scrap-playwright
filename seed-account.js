const db = require("./config/db");
require("dotenv").config();

const email = process.env.LINKEDIN_EMAIL;
const password = process.env.LINKEDIN_PASSWORD;

(async () => {
  try {
    if (!email || !password) {
      console.error("Email/Pass tidak ditemukan di .env");
      return;
    }

    console.log(`Seeding akun: ${email}`);

    const query = `
      INSERT INTO accounts (email, password, is_active)
      VALUES ($1, $2, true)
      ON CONFLICT (email) 
      DO UPDATE SET password = $2, is_active = true
      RETURNING *;
    `;

    const res = await db.query(query, [email, password]);
    console.log("Akun berhasil disimpan ke DB:", res.rows[0]);
  } catch (err) {
    console.error("Gagal seeding akun:", err);
  } finally {
    process.exit();
  }
})();
