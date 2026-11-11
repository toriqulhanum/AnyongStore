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

const {
    authenticateToken,
    authorizeRole
} = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', 
    getProducts
    );

router.get('/:id',
    validateProductId, 
    getProductById
    );

router.post('/',
    authenticateToken,
    authorizeRole('admin'),
    validateProduct,
    createProduct
);

router.put('/:id', 
    authenticateToken,
    authorizeRole('admin'),
    validateProductId, 
    validateProduct, 
    updateProduct
    );

router.delete('/:id',
    authenticateToken,
    authorizeRole('admin'),
    validateProductId, 
    deleteProduct
    );

module.exports = router;