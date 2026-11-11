const db = require('../config/database');


const getProducts = (req, res) => {
    const { search, category_id, page, limit, sort } = req.query;

    const parseInteger = (value, defaultValue, min, max) => {
        if (value === undefined) return defaultValue;

        if (
            typeof value !== 'string' ||
            !/^\d+$/.test(value)
        ) {
            return null;
        }

        const number = Number(value);

        if (
            !Number.isSafeInteger(number) ||
            number < min ||
            number > max
        ) {
            return null;
        }

        return number;
    };

    const currentPage = parseInteger(page, 1, 1, 2147483647);
    const perPage = parseInteger(limit, 10, 1, 100);

    if (currentPage === null || perPage === null) {
        return res.status(400).json({
            message: 'page harus minimal 1 dan limit harus antara 1-100'
        });
    }

    if (
        search !== undefined &&
        (typeof search !== 'string' || search.trim().length > 100)
    ) {
        return res.status(400).json({
            message: 'search harus berupa teks maksimal 100 karakter'
        });
    }

    const categoryId = parseInteger(
        category_id,
        null,
        1,
        2147483647
    );

    if (category_id !== undefined && categoryId === null) {
        return res.status(400).json({
            message: 'category_id harus berupa bilangan bulat positif'
        });
    }

    const sortOptions = {
        price_asc: 'price ASC, id ASC',
        price_desc: 'price DESC, id DESC',
        name_asc: 'name ASC, id ASC',
        name_desc: 'name DESC, id DESC',
        newest: 'id DESC',
        oldest: 'id ASC'
    };

    const sortBy = sort || 'newest';

    if (!Object.prototype.hasOwnProperty.call(sortOptions, sortBy)) {
        return res.status(400).json({
            message: 'sort harus berupa price_asc, price_desc, name_asc, name_desc, newest, atau oldest'
        });
    }

    const conditions = [];
    const values = [];

    if (search !== undefined && search.trim() !== '') {
        conditions.push('name LIKE ?');
        values.push(`%${search.trim()}%`);
    }

    if (categoryId !== null) {
        conditions.push('category_id = ?');
        values.push(categoryId);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const offset = (currentPage - 1) * perPage;

    const countSql = `
        SELECT COUNT(*) AS total
        FROM products
        ${whereClause}
    `;

    db.query(countSql, values, (countError, countResults) => {
        if (countError) {
            console.error('Gagal menghitung produk:', countError);

            return res.status(500).json({
                message: 'Gagal menghitung data produk'
            });
        }

        const total = Number(countResults[0].total);

        if (!Number.isSafeInteger(offset) || offset > 4294967295) {
            return res.status(400).json({
                message: 'Nomor halaman terlalu besar'
            });
        }

        const sql = `
            SELECT *
            FROM products
            ${whereClause}
            ORDER BY ${sortOptions[sortBy]}
            LIMIT ? OFFSET ?
        `;

        db.query(
            sql,
            [...values, perPage, offset],
            (err, results) => {
                if (err) {
                    console.error('Gagal mengambil produk:', err);

                    return res.status(500).json({
                        message: 'Gagal mengambil data produk'
                    });
                }

                return res.status(200).json({
                    data: results,
                    pagination: {
                        page: currentPage,
                        limit: perPage,
                        total,
                        totalPages: Math.ceil(total / perPage)
                    },
                    filters: {
                        search: search?.trim() || null,
                        category_id: categoryId,
                        sort: sortBy
                    }
                });
            }
        );
    });
};


const getProductById = (req, res) => {
    const { id } = req.params;

    const sql = `
    SELECT * FROM products WHERE id = ?
    `;

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
            return res.status(404).json({
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
