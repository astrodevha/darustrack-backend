const express = require('express');
const router = express.Router();
const curriculumController = require('../controllers/curriculumController');
const roleValidation = require('../middlewares/roleValidation');

// Get data kurikulum (hanya satu yang tersedia)
router.get('/', curriculumController.getCurriculum);

router.put('/:id', roleValidation(["admin"]), curriculumController.updateCurriculum);

module.exports = router;