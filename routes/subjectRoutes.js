const express = require('express');
const router = express.Router();

const subjectCtrl = require('../controllers/subjectController');
const roleValidation = require('../middlewares/roleValidation');
const asyncHandler = require('../middlewares/asyncHandler');

router.get('/', asyncHandler(subjectCtrl.listSubjects));
router.get('/:id', asyncHandler(subjectCtrl.getSubject));

router.post('/', roleValidation(['admin']), asyncHandler(subjectCtrl.createSubject));
router.put('/:id', roleValidation(['admin']), asyncHandler(subjectCtrl.updateSubject));
router.delete('/:id', roleValidation(['admin']), asyncHandler(subjectCtrl.deleteSubject));

module.exports = router;
