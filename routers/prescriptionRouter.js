const express = require('express');
const router = express.Router();
const PrescriptionController = require('../controllers/prescriptionController');

/**
 * POST /prescriptions
 * Emit a new digital prescription with simulated e-signature.
 * Body: { patient_id, doctor_id, pharmacy_id?, items: [{ medicine_name, dosage?, instructions?, quantity? }] }
 */
router.post('/', PrescriptionController.create);

/**
 * GET /prescriptions/patient/:patientId
 * Get all prescriptions for a specific patient (with items and pharmacy info).
 */
router.get('/patient/:patientId', PrescriptionController.getByPatient);

/**
 * GET /prescriptions/pharmacy/:pharmacyId
 * Get all prescriptions routed to a specific pharmacy.
 */
router.get('/pharmacy/:pharmacyId', PrescriptionController.getByPharmacy);

module.exports = router;
