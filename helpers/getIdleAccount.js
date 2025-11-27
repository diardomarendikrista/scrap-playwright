const db = require("../config/db");

async function getIdleAccount() {
  // Ambil akun yang tidak sedang dipakai
  const query = `
    UPDATE accounts
    SET is_busy = TRUE, last_used = NOW()
    WHERE id = (
      SELECT id FROM accounts
      WHERE is_active = TRUE AND is_busy = FALSE
      ORDER BY last_used ASC NULLS FIRST
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING email, password;
  `;
  const res = await db.query(query);
  return res.rows[0];
}

async function releaseAccount(email) {
  // Kembalikan status jadi free
  const query = `UPDATE accounts SET is_busy = FALSE WHERE email = $1`;
  await db.query(query, [email]);
}

module.exports = { getIdleAccount, releaseAccount };
