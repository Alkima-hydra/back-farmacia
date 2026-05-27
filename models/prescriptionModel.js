const pool = require('../config/db');

/**
 * Prescription Model
 * Handles all database interactions for prescriptions and their items.
 */
const PrescriptionModel = {
  /**
   * Creates a new prescription along with its items in a single transaction.
   * @param {Object} data - { patient_id, doctor_id, pharmacy_id, digital_signature, items[] }
   * @returns {Object} The created prescription with its items
   */
  async create({ patient_id, doctor_id, pharmacy_id, digital_signature, items = [] }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert the prescription header
      const prescriptionResult = await client.query(
        `INSERT INTO prescriptions (patient_id, doctor_id, pharmacy_id, digital_signature, status)
         VALUES ($1, $2, $3, $4, 'emitida')
         RETURNING *`,
        [patient_id, doctor_id, pharmacy_id || null, digital_signature]
      );
      const prescription = prescriptionResult.rows[0];

      // Insert prescription items
      const insertedItems = [];
      for (const item of items) {
        const itemResult = await client.query(
          `INSERT INTO prescription_items (prescription_id, medicine_name, dosage, instructions, quantity)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [prescription.id, item.medicine_name, item.dosage || null, item.instructions || null, item.quantity || 1]
        );
        insertedItems.push(itemResult.rows[0]);
      }

      await client.query('COMMIT');
      return { ...prescription, items: insertedItems };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Retrieves all prescriptions for a given patient, including their items and pharmacy info.
   * @param {string} patientId - UUID of the patient
   * @returns {Array} List of prescriptions with items
   */
  async findByPatient(patientId) {
    const prescriptionsResult = await pool.query(
      `SELECT
         p.*,
         u_doc.full_name AS doctor_name,
         u_doc.email    AS doctor_email,
         ph.name        AS pharmacy_name,
         ph.address     AS pharmacy_address,
         ph.phone       AS pharmacy_phone
       FROM prescriptions p
       JOIN users u_doc ON u_doc.id = p.doctor_id
       LEFT JOIN pharmacies ph ON ph.id = p.pharmacy_id
       WHERE p.patient_id = $1
       ORDER BY p.created_at DESC`,
      [patientId]
    );

    const prescriptions = prescriptionsResult.rows;

    // Attach items to each prescription
    for (const prescription of prescriptions) {
      const itemsResult = await pool.query(
        `SELECT * FROM prescription_items WHERE prescription_id = $1`,
        [prescription.id]
      );
      prescription.items = itemsResult.rows;
    }

    return prescriptions;
  },

  /**
   * Retrieves all prescriptions sent to a specific pharmacy.
   * @param {string} pharmacyId - UUID of the pharmacy
   * @returns {Array} List of prescriptions with patient/doctor info and items
   */
  async findByPharmacy(pharmacyId) {
    const prescriptionsResult = await pool.query(
      `SELECT
         p.*,
         u_pat.full_name AS patient_name,
         u_pat.dni       AS patient_dni,
         u_doc.full_name AS doctor_name
       FROM prescriptions p
       JOIN users u_pat ON u_pat.id = p.patient_id
       JOIN users u_doc ON u_doc.id = p.doctor_id
       WHERE p.pharmacy_id = $1
       ORDER BY p.created_at DESC`,
      [pharmacyId]
    );

    const prescriptions = prescriptionsResult.rows;

    for (const prescription of prescriptions) {
      const itemsResult = await pool.query(
        `SELECT * FROM prescription_items WHERE prescription_id = $1`,
        [prescription.id]
      );
      prescription.items = itemsResult.rows;
    }

    return prescriptions;
  },

  /**
   * Updates the status of a prescription (e.g., emitida → enviada).
   * @param {string} id - UUID of the prescription
   * @param {string} status - New status
   * @returns {Object} Updated prescription
   */
  async updateStatus(id, status) {
    const result = await pool.query(
      `UPDATE prescriptions SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return result.rows[0] || null;
  },
};

module.exports = PrescriptionModel;
