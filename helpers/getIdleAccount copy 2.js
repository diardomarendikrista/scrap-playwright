const db = require("../config/db");
const HOURLY_LIMIT = 8;

async function getIdleAccount() {
  // cek kondisi akun bisa dipakai ketika apa
  // skrg sejam maksimal adalah {HOURLY_LIMIT} kali scrape

  const query = `
    UPDATE accounts
    SET 
      is_busy = TRUE, 
      
      -- Logic Reset Counter:
      -- Jika (Sekarang - LastUsed) > 1 jam, atau LastUsed NULL (akun baru), reset jadi 1.
      -- Jika tidak, tambah 1.
      hourly_count = CASE 
        WHEN last_used IS NULL OR EXTRACT(EPOCH FROM (NOW() - last_used)) > 3600 THEN 1 
        ELSE hourly_count + 1 
      END,
      
      last_used = NOW() -- Update waktu pemakaian sekarang
      
    WHERE id = (
      SELECT id FROM accounts
      WHERE is_active = TRUE 
        AND is_busy = FALSE
        AND (
          -- Syarat 1: Akun baru (belum pernah dipakai)
          last_used IS NULL
          OR
          -- Syarat 2: Sudah istirahat lebih dari 1 jam (Reset Kuota)
          EXTRACT(EPOCH FROM (NOW() - last_used)) > 3600
          OR 
          -- Syarat 3: Masih dalam periode 1 jam yg sama, TAPI kuota belum habis
          hourly_count < ${HOURLY_LIMIT}
        )
      ORDER BY last_used ASC NULLS FIRST -- Prioritaskan yang paling lama nganggur
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING email, password, hourly_count;
  `;

  try {
    const res = await db.query(query);
    return res.rows[0];
  } catch (error) {
    console.error("[Account Rotation] Error:", error.message);
    return null;
  }
}

async function releaseAccount(email) {
  const query = `UPDATE accounts SET is_busy = FALSE WHERE email = $1`;
  await db.query(query, [email]);
}

module.exports = { getIdleAccount, releaseAccount, HOURLY_LIMIT };
