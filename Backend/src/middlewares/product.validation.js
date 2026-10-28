const db = require('../config/database');

const validateProduct = (req, res, next) => {
    const {
        category_id,
        name,
        description,
        price,
        stock,
        image,
        source
    } = req.body;

    if (
        category_id === undefined ||
        !Number.isInteger(Number(category_id)) ||
        Number(category_id) <= 0 
    ) {
        return res.status(400).json({
            message: 'category_id harus berupa ID kategori yang valid'
        });
    }

    if (typeof name !== 'string' || name.trim().length < 4) {
        return res.status(400).json({
            message: 'Nama produk harus minimal 4 karakter'
        });
    }

    if (
        price === undefined ||
        price === null ||
        price === '' ||
        !Number.isFinite(Number(price)) ||
        Number(price) <= 0
    ) {
        return res.status(400).json({
            message: 'Harga harus berupa angka yang lebih besar dari 0'
        });
    }

    if (
        stock === undefined ||
        stock === null ||
        stock === '' ||
        !Number.isInteger(Number(stock)) ||
        Number(stock) < 0
    ) {
        return res.status(400).json({
            message: 'stok harus berupa bilangan bulat minimal 0'
        });
    }

    if (typeof source !== 'string' || source.trim().length === 0) {
        return res.status(400).json({
            message: 'source harus diisi'
        });
    }

    if ((description !== undefined && 
        description !== null && 
        typeof description !== 'string') ||
        (image !== undefined &&
            image !== null &&
            typeof image !== 'string')
    ) {
        return res.status(400).json({
            message: 'description dan image harus berupa string'
        });
    }

    db.query(
        'SELECT id FROM categories WHERE id = ?',
        [Number(category_id)],
        (err, results) => {
            if (err) {
                console.error('validasi kategori gagal:', err);

                return res.status(500).json({
                    message: 'gagal memvalidasi kategori produk'
                });
            }

            if (results.length === 0) {
                return res.status(400).json({
                    message: 'kategori produk tidak ditemukan'
                });
            }
            next();
        }
    );
};

const validateProductId = (req, res, next) => {
    const { id } = req.params;

    if (!/^\d+$/.test(id) || Number(id) <= 0) {
        return res.status(400).json({
            message: 'ID produk harus berupa bilangan bulat positif'
        });
    }


    next(); 
};

module.exports = { 
    validateProduct,
    validateProductId
};
