const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const scheduleController = require('../controllers/scheduleController');

// Class routes
router.get('/', classController.getActiveClasses);

// Schedule routes
router.get('/:class_id/schedule', scheduleController.getClassSchedules);
router.post('/:class_id/schedule', scheduleController.createSchedule);
router.put('/schedule/:schedule_id', scheduleController.updateSchedule);
router.delete('/schedule/:schedule_id', scheduleController.deleteSchedule);

module.exports = router;