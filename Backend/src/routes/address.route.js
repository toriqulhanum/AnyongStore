const express = require('express');
const router = express.Router();

const {
    createAddress,
    getAddresses,
    getAddressById,
    updateAddress,
    setDefaultAddress,
    deleteAddress
} = require('../controllers/address.controller');

const {
    authenticateToken
} = require('../middlewares/auth.middleware');

router.use(authenticateToken);

router.post(
    '/',
    createAddress
);

router.get(
    '/',
    getAddresses
);

router.get(
    '/:id',
    getAddressById
);

router.patch(
    '/:id',
    updateAddress
);

router.patch(
    '/:id/default',
    setDefaultAddress
);

router.delete(
    '/:id',
    deleteAddress
);

module.exports = router;