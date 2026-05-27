const LabResultModel = require('../models/labResultModel');
const pool = require('../config/db');

const LabResultController = {
  /**
   * POST /labs/results
   * Receives a lab result from an external laboratory and associates it
   * with the patient's clinical record / history.
   *
   * Body: { patient_id, lab_name, test_name, result_value, result_unit, reference_range, file_url }
   */
  async create(req, res, next) {
    try {
      const { patient_id, lab_name, test_name, result_value, result_unit, reference_range, file_url } = req.body;

      // Validate required fields
      if (!patient_id) {
        const err = new Error('patient_id is required');
        err.status = 400;
        throw err;
      }
      if (!lab_name) {
        const err = new Error('lab_name is required');
        err.status = 400;
        throw err;
      }
      if (!test_name) {
        const err = new Error('test_name is required');
        err.status = 400;
        throw err;
      }

      // Verify patient exists and has role 'paciente'
      const userResult = await pool.query(
        `SELECT id, role, full_name FROM users WHERE id = $1 AND is_active = true`,
        [patient_id]
      );
      if (userResult.rows.length === 0) {
        const err = new Error(`Patient with id ${patient_id} not found or is inactive`);
        err.status = 404;
        throw err;
      }
      if (userResult.rows[0].role !== 'paciente') {
        const err = new Error(`User ${patient_id} is not a patient`);
        err.status = 400;
        throw err;
      }

      // Save the lab result (it references the patient via patient_id,
      // which links to the clinical record through the patient's record)
      const labResult = await LabResultModel.create({
        patient_id,
        lab_name,
        test_name,
        result_value,
        result_unit,
        reference_range,
        file_url,
      });

      return res.status(201).json({
        success: true,
        message: 'Lab result received',
        data: {
          lab_result: labResult,
          patient: {
            id: patient_id,
            name: userResult.rows[0].full_name,
          }
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /labs/results/patient/:patientId
   * Returns all lab results for a given patient.
   * Supports optional query filters: lab_name, test_name, from_date, to_date
   */
  async getByPatient(req, res, next) {
    try {
      const { patientId } = req.params;
      const { lab_name, test_name, from_date, to_date } = req.query;

      // Verify patient exists
      const userResult = await pool.query(
        `SELECT id, full_name, role FROM users WHERE id = $1 AND is_active = true`,
        [patientId]
      );
      if (userResult.rows.length === 0) {
        const err = new Error(`Patient with id ${patientId} not found`);
        err.status = 404;
        throw err;
      }

      // Validate date formats if provided
      if (from_date && isNaN(Date.parse(from_date))) {
        const err = new Error('Invalid from_date format. Use ISO 8601 (e.g. 2024-01-01)');
        err.status = 400;
        throw err;
      }
      if (to_date && isNaN(Date.parse(to_date))) {
        const err = new Error('Invalid to_date format. Use ISO 8601 (e.g. 2024-12-31)');
        err.status = 400;
        throw err;
      }

      const results = await LabResultModel.findByPatient(patientId, {
        lab_name,
        test_name,
        from_date,
        to_date,
      });

      return res.status(200).json({
        success: true,
        patient: {
          id: patientId,
          name: userResult.rows[0].full_name,
        },
        count: results.length,
        filters_applied: {
          ...(lab_name && { lab_name }),
          ...(test_name && { test_name }),
          ...(from_date && { from_date }),
          ...(to_date && { to_date }),
        },
        data: results,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = LabResultController;
