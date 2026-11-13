const express = require('express');
const router = express.Router();

const {
    getProfile, 
    updateProfile
} = require('../controllers/profile.controller');

const {
    authenticateToken
} = require('../middlewares/auth.middleware'); 

router.get(
    '/',
    authenticateToken,
    getProfile
);

router.patch(
    '/',
    authenticateToken,
    updateProfile
);

module.exports = router;