const db = require("../config/db");

class QueueRepository {
  async add(urls) {
    let addedCount = 0;
    for (const item of urls) {
      // Jika URL sudah ada (misal status 'done' bulan lalu),
      // kita paksa ubah jadi 'pending' lagi agar worker mengambilnya ulang.
      // Kita juga reset 'attempts' jadi 0 dan hapus error log lama.
      const query = `
        INSERT INTO scrape_queue (target_url, status, created_at)
        VALUES ($1, 'pending', NOW())
        ON CONFLICT (target_url) 
        DO UPDATE SET 
          status = 'pending',
          attempts = 0,
          error_log = NULL,
          updated_at = NOW();
      `;

      await db.query(query, [item.url]);
      addedCount++;
    }
    return addedCount;
  }

  async getNextPending() {
    // Query ini melakukan:
    // 1. Cari ID pending.
    // 2. Kunci barisnya (FOR UPDATE) dan lewati yg dikunci orang lain (SKIP LOCKED).
    // 3. Update status jadi 'processing'.
    // 4. Kembalikan data row-nya ke script.
    const query = `
      UPDATE scrape_queue
      SET status = 'processing', updated_at = NOW()
      WHERE id = (
        SELECT id
        FROM scrape_queue
        WHERE status = 'pending'
        ORDER BY updated_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;
    const res = await db.query(query);
    return res.rows[0];
  }

  async updateStatus(id, status, errorLog = null) {
    const query = `
      UPDATE scrape_queue 
      SET status = $1, error_log = $2, updated_at = NOW() 
      WHERE id = $3
    `;
    await db.query(query, [status, errorLog, id]);
  }
}

module.exports = new QueueRepository();
