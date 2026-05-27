const crypto = require('crypto');
const PrescriptionModel = require('../models/prescriptionModel');
const pool = require('../config/db');

/**
 * Simulates a digital signature for a prescription.
 * In production this would integrate with a PKI / e-signature provider.
 * @param {string} doctorId
 * @param {string} patientId
 * @returns {string} Hex-encoded HMAC signature
 */
function generateDigitalSignature(doctorId, patientId) {
  const secret = process.env.SIGNATURE_SECRET || 'telemedicina-secret-key';
  const payload = `${doctorId}:${patientId}:${Date.now()}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Validates that both the patient and doctor exist and have the correct roles.
 * @param {string} patientId
 * @param {string} doctorId
 * @throws Error if either user is not found or has an incorrect role
 */
async function validateUsers(patientId, doctorId) {
  const result = await pool.query(
    `SELECT id, role FROM users WHERE id = ANY($1::uuid[]) AND is_active = true`,
    [[patientId, doctorId]]
  );

  const users = result.rows;
  const patient = users.find((u) => u.id === patientId);
  const doctor = users.find((u) => u.id === doctorId);

  if (!patient) {
    const err = new Error(`Patient with id ${patientId} not found or is inactive`);
    err.status = 404;
    throw err;
  }
  if (patient.role !== 'paciente') {
    const err = new Error(`User ${patientId} is not a patient`);
    err.status = 400;
    throw err;
  }
  if (!doctor) {
    const err = new Error(`Doctor with id ${doctorId} not found or is inactive`);
    err.status = 404;
    throw err;
  }
  if (doctor.role !== 'medico') {
    const err = new Error(`User ${doctorId} is not a doctor`);
    err.status = 400;
    throw err;
  }
}

const PrescriptionController = {
  /**
   * POST /prescriptions
   * Emits a new digital prescription with a simulated electronic signature.
   * Optionally assigns a destination pharmacy.
   */
  async create(req, res, next) {
    try {
      const { patient_id, doctor_id, pharmacy_id, items } = req.body;

      // Validate required fields
      if (!patient_id || !doctor_id) {
        const err = new Error('patient_id and doctor_id are required');
        err.status = 400;
        throw err;
      }
      if (!Array.isArray(items) || items.length === 0) {
        const err = new Error('At least one item is required in the prescription');
        err.status = 400;
        throw err;
      }
      for (const item of items) {
        if (!item.medicine_name) {
          const err = new Error('Each item must have a medicine_name');
          err.status = 400;
          throw err;
        }
      }

      // Validate users exist and have correct roles
      await validateUsers(patient_id, doctor_id);

      // Validate pharmacy exists if provided
      if (pharmacy_id) {
        const pharmaResult = await pool.query(
          `SELECT id FROM pharmacies WHERE id = $1`,
          [pharmacy_id]
        );
        if (pharmaResult.rows.length === 0) {
          const err = new Error(`Pharmacy with id ${pharmacy_id} not found`);
          err.status = 404;
          throw err;
        }
      }

      // Generate simulated electronic signature
      const digital_signature = generateDigitalSignature(doctor_id, patient_id);

      // Determine status: if pharmacy is set, mark as sent
      const prescription = await PrescriptionModel.create({
        patient_id,
        doctor_id,
        pharmacy_id,
        digital_signature,
        items,
      });

      // If a pharmacy was assigned, update status to 'enviada'
      if (pharmacy_id) {
        await PrescriptionModel.updateStatus(prescription.id, 'enviada');
        prescription.status = 'enviada';
      }

      return res.status(201).json({
        success: true,
        message: pharmacy_id
          ? 'Prescription issued and sent to pharmacy successfully'
          : 'Prescription issued successfully',
        data: prescription,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /prescriptions/patient/:patientId
   * Returns all prescriptions for a given patient, including items and pharmacy info.
   */
  async getByPatient(req, res, next) {
    try {
      const { patientId } = req.params;

      // Verify patient exists
      const userResult = await pool.query(
        `SELECT id, role FROM users WHERE id = $1 AND is_active = true`,
        [patientId]
      );
      if (userResult.rows.length === 0) {
        const err = new Error(`Patient with id ${patientId} not found`);
        err.status = 404;
        throw err;
      }

      const prescriptions = await PrescriptionModel.findByPatient(patientId);

      return res.status(200).json({
        success: true,
        count: prescriptions.length,
        data: prescriptions,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /prescriptions/pharmacy/:pharmacyId
   * Returns all prescriptions routed to a specific pharmacy.
   */
  async getByPharmacy(req, res, next) {
    try {
      const { pharmacyId } = req.params;

      // Verify pharmacy exists
      const pharmaResult = await pool.query(
        `SELECT id, name FROM pharmacies WHERE id = $1`,
        [pharmacyId]
      );
      if (pharmaResult.rows.length === 0) {
        const err = new Error(`Pharmacy with id ${pharmacyId} not found`);
        err.status = 404;
        throw err;
      }

      const prescriptions = await PrescriptionModel.findByPharmacy(pharmacyId);

      return res.status(200).json({
        success: true,
        pharmacy: pharmaResult.rows[0],
        count: prescriptions.length,
        data: prescriptions,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = PrescriptionController;
