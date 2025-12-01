const db = require("../config/db");

class ProfileRepository {
  /**
   * @param {Object} data - Data scraping
   * @param {String} status - 'success' | 'failed' | 'not_found'
   * @param {String} note - Note for error message, etc
   */
  async save(data, status = "success", note = null) {
    // 1. Bongkar data dari Scraper
    // Struktur data dari composite scraper adalah:
    // { profile: {...}, experience: [...], education: [...], ... }
    const {
      url, // akan inject ini di Service nanti
      profile,
      experience,
      education,
      certification,
      project,
      skill,
      recommendation,
    } = data;

    // 2. Siapkan Query Upsert (Insert atau Update kalau URL sudah ada)
    const query = `
      INSERT INTO profiles (
        url, 
        name, 
        headline, 
        location, 
        about, 
        photo_url,
        experiences, 
        educations, 
        certifications, 
        projects, 
        skills, 
        recommendations,
        scraped_at,
        status,
        note
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13, $14)
      ON CONFLICT (url) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        headline = EXCLUDED.headline,
        location = EXCLUDED.location,
        about = EXCLUDED.about,
        photo_url = EXCLUDED.photo_url,
        experiences = EXCLUDED.experiences,
        educations = EXCLUDED.educations,
        certifications = EXCLUDED.certifications,
        projects = EXCLUDED.projects,
        skills = EXCLUDED.skills,
        recommendations = EXCLUDED.recommendations,
        scraped_at = NOW(),
        status = EXCLUDED.status,
        note = EXCLUDED.note
      RETURNING id;
    `;

    // 3. Mapping Values
    // Kolom biasa ambil dari object 'profile', kolom list di-stringify ke JSONB
    const values = [
      url,
      profile?.name || null,
      profile?.headline || null,
      profile?.location || null,
      profile?.about || null,
      profile?.photo || null,
      JSON.stringify(experience || []),
      JSON.stringify(education || []),
      JSON.stringify(certification || []),
      JSON.stringify(project || []),
      JSON.stringify(skill || []),
      JSON.stringify(recommendation || []),
      status,
      note,
    ];

    try {
      const res = await db.query(query, values);
      console.log(`[DB] Profile saved: ${url} (Status: ${status})`);
      return res.rows[0].id;
    } catch (err) {
      console.error("[DB Error] Gagal insert profile:", err.message);
      throw err;
    }
  }
}

module.exports = new ProfileRepository();
