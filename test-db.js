const db = require("./config/db");

(async () => {
  try {
    console.log("Mencoba koneksi ke database...");
    const res = await db.query("SELECT NOW()");
    console.log("Koneksi Berhasil! Waktu Server DB:", res.rows[0].now);

    // Cek tabel
    const tables = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema='public'
    `);
    console.log(
      "Tabel yang tersedia:",
      tables.rows.map((r) => r.table_name)
    );
  } catch (err) {
    console.error("Koneksi Gagal:", err.message);
  } finally {
    process.exit();
  }
})();
