var express = require('express');
var router = express.Router();
const userController = require('../controllers/userController');

// Get all users with optional role filter
router.get('/', userController.getAllUsers);

// Get single user by ID
router.get('/:id', userController.getUserById);

// Create new user
router.post('/', userController.createUser);

// Update user
router.put('/:id', userController.updateUser
);

// Delete user
router.delete('/:id', userController.deleteUser);

module.exports = router;