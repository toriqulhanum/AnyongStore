const express = require('express');

const {
    checkout,
    getMyOrders,
    getOrderById
} = require('../controllers/order.controller');

const {
    authenticateToken
} = require('../middlewares/auth.middleware');

const router = express.Router();

router.get(
    '/',
    authenticateToken,
    getMyOrders
);

router.post(
    '/checkout',
    authenticateToken,
    checkout
);

router.get(
    '/:id',
    authenticateToken,
    getOrderById
)

module.exports = router;

