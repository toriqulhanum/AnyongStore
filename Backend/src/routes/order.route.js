
const express = require('express');

const {
    checkout,
    getMyOrders,
    getOrderById,
    getAllOrders,
    getOrderDetailAdmin,
    updateOrderStatus
} = require('../controllers/order.controller');

const {
    authenticateToken,
    authorizeRole
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
    '/admin',
    authenticateToken,
    authorizeRole('admin'),
    getAllOrders
);

router.get(
    '/admin/:id',
    authenticateToken,
    authorizeRole('admin'),
    getOrderDetailAdmin
);

router.patch(
    '/admin/:id/status',
    authenticateToken,
    authorizeRole('admin'),
    updateOrderStatus
);

router.get(
    '/:id',
    authenticateToken,
    getOrderById
);

module.exports = router;