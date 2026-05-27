const pool = require('../config/db');

/**
 * LabResult Model
 * Handles all database interactions for laboratory results.
 */
const LabResultModel = {
  /**
   * Saves a new lab result received from an external laboratory.
   * @param {Object} data - { patient_id, lab_name, test_name, result_value, result_unit, reference_range, file_url }
   * @returns {Object} The saved lab result
   */
  async create({ patient_id, lab_name, test_name, result_value, result_unit, reference_range, file_url }) {
    const result = await pool.query(
      `INSERT INTO lab_results
         (patient_id, lab_name, test_name, result_value, result_unit, reference_range, file_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [patient_id, lab_name, test_name, result_value || null, result_unit || null, reference_range || null, file_url || null]
    );
    return result.rows[0];
  },

  /**
   * Retrieves all lab results for a given patient, with optional filters.
   * @param {string} patientId - UUID of the patient
   * @param {Object} filters - Optional: { lab_name, test_name, from_date, to_date }
   * @returns {Array} List of lab results
   */
  async findByPatient(patientId, filters = {}) {
    const conditions = ['lr.patient_id = $1'];
    const values = [patientId];
    let paramIndex = 2;

    if (filters.lab_name) {
      conditions.push(`lr.lab_name ILIKE $${paramIndex}`);
      values.push(`%${filters.lab_name}%`);
      paramIndex++;
    }

    if (filters.test_name) {
      conditions.push(`lr.test_name ILIKE $${paramIndex}`);
      values.push(`%${filters.test_name}%`);
      paramIndex++;
    }

    if (filters.from_date) {
      conditions.push(`lr.received_at >= $${paramIndex}`);
      values.push(filters.from_date);
      paramIndex++;
    }

    if (filters.to_date) {
      conditions.push(`lr.received_at <= $${paramIndex}`);
      values.push(filters.to_date);
      paramIndex++;
    }

    const query = `
      SELECT
        lr.*,
        u.full_name AS patient_name,
        u.dni       AS patient_dni
      FROM lab_results lr
      JOIN users u ON u.id = lr.patient_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY lr.received_at DESC
    `;

    const result = await pool.query(query, values);
    return result.rows;
  },

  /**
   * Finds a single lab result by its ID.
   * @param {string} id - UUID of the lab result
   * @returns {Object|null}
   */
  async findById(id) {
    const result = await pool.query(
      `SELECT lr.*, u.full_name AS patient_name
       FROM lab_results lr
       JOIN users u ON u.id = lr.patient_id
       WHERE lr.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },
};

module.exports = LabResultModel;
