const express = require('express');
const authController = require('./auth.controller');
const { autenticar } = require('../../shared/middleware/auth.middleware');

const router = express.Router();

router.post('/login', authController.login);

router.post(
  '/logout',
  autenticar,
  authController.logout
);

module.exports = router;