const express = require('express');
const {
    validateProduct,
    validateProductId
} = require('../middlewares/product.validation');

const {
    getProducts,
    getProductById,
    createProduct, 
    updateProduct,
    deleteProduct
} = require('../controllers/product.controller');

const router = express.Router();

router.get('/', getProducts);
router.get('/:id', validateProductId, getProductById);
router.post('/', validateProduct, createProduct);
router.put('/:id', validateProductId, validateProduct, updateProduct);
router.delete('/:id', validateProductId, deleteProduct);

module.exports = router;