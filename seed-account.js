const db = require("./config/db");
const fs = require("fs");
const path = require("path");

(async () => {
  try {
    // 1. Baca file JSON
    const filePath = path.join(__dirname, "accounts.json");

    if (!fs.existsSync(filePath)) {
      console.error("File accounts.json tidak ditemukan!");
      return;
    }

    const rawData = fs.readFileSync(filePath);
    const accounts = JSON.parse(rawData);

    console.log(`Ditemukan ${accounts.length} akun untuk di-seed.`);

    // 2. Query SQL
    const query = `
      INSERT INTO accounts (email, password, is_active, hourly_count, last_used, note)
      VALUES ($1, $2, true, 0, NULL, $3)
      ON CONFLICT (email) 
      DO UPDATE SET 
        password = $2, 
        is_active = true,
        hourly_count = 0, 
        last_used = NULL,
        note = $3  -- Update note jika akun sudah ada
      RETURNING email;
    `;

    // 3. Loop insert
    let successCount = 0;

    for (const acc of accounts) {
      try {
        if (!acc.email || !acc.password) {
          console.warn(`Skipping data tidak lengkap: ${JSON.stringify(acc)}`);
          continue;
        }

        // Masukkan acc.note (atau null jika kosong)
        await db.query(query, [acc.email, acc.password, acc.note || null]);

        console.log(
          `✅ Seeded: ${acc.email} ${acc.note ? `(${acc.note})` : ""}`
        );
        successCount++;
      } catch (err) {
        console.error(`❌ Gagal insert ${acc.email}:`, err.message);
      }
    }

    console.log(
      `\n=== Selesai! ${successCount}/${accounts.length} akun berhasil masuk DB. ===`
    );
  } catch (err) {
    console.error("Critical Error saat seeding:", err);
  } finally {
    await db.pool.end();
    process.exit();
  }
})();
