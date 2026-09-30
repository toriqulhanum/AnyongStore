const db = require('../config/database');

const getProducts = (req, res) => {
    const sql = 'SELECT * FROM products';

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                message: 'Gagal mengambil data produk'
            });
        }
        res.json(results);
    });
};

const getProductById = (req, res) => {
    const { id } = req.params;

    const sql = 'SELECT * FROM products WHERE id = ?';

    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                message: 'Gagal mengambil data produk'
            })
        }
        if (results.length === 0) {
            return res.status(404).json({
                message: 'Produk tidak ditemukan'
            })
        }

        res.json(results[0]);
            });
        };

const createProduct = (req, res) => {
    const {
        category_id,
        name,
        description,
        price,
        stock,
        image,
        source
    } = req.body;

    const sql = `
        INSERT INTO products
        (category_id, name, description, price, stock, image, source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        category_id,
        name,
        description,
        price,
        stock,
        image,
        source
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error(err);

            return res.status(500).json({
                message: 'Gagal menambahkan produk'
            });
        }

        res.status(201).json({
            message: 'Produk berhasil ditambahkan',
            productId: result.insertId
        });
    });
};

const updateProduct = (req, res) => {
    const { id } = req.params;

    const {
        category_id,
        name,
        description,
        price,
        stock,
        image,
        source
    } = req.body;

    const sql = `
        UPDATE products
        SET
            category_id = ?,
            name = ?,
            description = ?,
            price = ?,
            stock = ?,
            image = ?,
            source = ?
        WHERE id = ?
    `;

    const values = [
        category_id,
        name,
        description,
        price,
        stock,
        image,
        source,
        id
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error(err);

            return res.status(500).json({
                message: 'Gagal mengupdate produk'
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Produk tidak ditemukan'
            });
        }

        res.json({
            message: 'Produk berhasil diupdate'
        });
    });
};

const deleteProduct = (req, res) => {
    const { id } = req.params;

    const sql = 'DELETE FROM products WHERE id = ?';

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error(err);

            return res.status(500).json({
                message: 'Gagal menghapus produk'
            });
        }
        if (result.affectedRows === 0) {
            return res.status(400).json({
                message: 'Produk tidak ditemukan'
            });
        }
        res.json({
            message: 'Produk berhasil dihapus'
        });
    });
};
module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
};