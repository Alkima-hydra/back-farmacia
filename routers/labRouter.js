const express = require('express');
const router = express.Router();
const LabResultController = require('../controllers/labResultController');

/**
 * POST /labs/results
 * Receive a lab result from an external laboratory and associate it with the patient.
 * Body: { patient_id, lab_name, test_name, result_value?, result_unit?, reference_range?, file_url? }
 */
router.post('/results', LabResultController.create);

/**
 * GET /labs/results/patient/:patientId
 * Get all lab results for a specific patient.
 * Query params (optional): lab_name, test_name, from_date, to_date
 */
router.get('/results/patient/:patientId', LabResultController.getByPatient);

module.exports = router;
