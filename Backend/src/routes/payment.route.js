const express = require('express');

const {
    createPayment,
    getMyPayments,
    getPaymentById,
    simulatePayment
} = require('../controllers/payment.controller');

const {
    authenticateToken,
    authorizeRole
} = require('../middlewares/auth.middleware');

const router = express.Router();

router.post(
    '/',
    authenticateToken,
    createPayment
);

router.get(
    '/',
    authenticateToken,
    getMyPayments
);

router.patch(
    '/admin/:id/simulate',
    authenticateToken,
    authorizeRole('admin'),
    simulatePayment
);

router.get(
    '/:id',
    authenticateToken,
    getPaymentById
);

module.exports = router;
