const express = require("express");

const {
    authenticateToken
} = require("../middlewares/auth.middleware");

const {
    validateAddCartItem,
    validateProductId
} = require('../middlewares/cart.validation');

const {
    getCart,
    addCartItem,
    updateCartItem,
    removeCartItem,
    clearCart
} = require('../controllers/cart.controller');

const router = express.Router();

router.use(authenticateToken);

router.get("/", getCart);

router.post(
    "/items",
    authenticateToken,
    addCartItem
);

router.patch(
    "/:productId",
    validateProductId,
    updateCartItem
);

router.delete(
    "/:productId",
    validateProductId,
    removeCartItem
);

router.delete(
    "/",
    authenticateToken,
    clearCart
);

module.exports = router;