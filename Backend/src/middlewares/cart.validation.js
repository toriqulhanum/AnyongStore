
const validateAddCartItem = (req, res, next) => {
    const { product_id, quantity } = req.body;

    if (
        !Number.isSafeInteger(product_id) ||
        product_id <= 0
    ) {
        return res.status(400).json({
            message: 'product_id harus berupa bilangan bulat positif'
        });
    }

    if (
        quantity !== undefined &&
        (!Number.isSafeInteger(quantity) || quantity <= 0)
    ) {
        return res.status(400).json({
            message: 'quantity harus berupa bilangan bulat positif'
        });
    }

    next();
};

const validateProductId = (req, res, next) => {
    const { productId } = req.params;

    if (!/^\d+$/.test(productId) || Number(productId) <= 0) {
        return res.status(400).json({
            message: 'ID produk harus berupa bilangan bulat positif'
        });
    }

    next();
};

module.exports = {
    validateAddCartItem,
    validateProductId
};
