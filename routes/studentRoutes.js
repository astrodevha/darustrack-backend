const express = require('express');
const router = express.Router();
const StudentController = require('../controllers/studentController');

// Student routes
router.get('/', StudentController.getAllStudents);
router.post('/', StudentController.createStudent);
router.put('/:id', StudentController.updateStudent);
router.delete('/:id', StudentController.deleteStudent);

module.exports = router;