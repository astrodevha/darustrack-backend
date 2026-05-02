const express = require('express');
const router = express.Router();
const classSumarryController = require('../controllers/classSummaryController');

// Endpoint: Get all classes summary
router.get('/classes', classSumarryController.getAllClassesSummary);

// Endpoint: Get detail class
router.get('/classes/:classId', classSumarryController.getDetailClassesSummary);

module.exports = router;