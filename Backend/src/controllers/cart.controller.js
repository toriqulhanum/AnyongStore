const db = require('../config/database');
const pool = db.promise();

const getOrCreateCart = async (connection, userId) => {
    await connection.query(
        'INSERT IGNORE INTO carts (user_id) VALUES (?)',
        [userId]
    );

    const [carts] = await connection.query(
        'SELECT id FROM carts WHERE user_id = ?',
        [userId]
    );

    if (carts.length === 0) {
        throw new Error('Keranjang gagal dibuat');
    }

    return carts[0].id;
};

const getCart = async (req, res) => {
    try {
        const [carts] = await pool.query(
            'SELECT id FROM carts WHERE user_id = ?',
            [req.user.id]
        );

        if (carts.length === 0) {
            return res.status(200).json({
                items: [],
                total: 0
            });
        }

        const [items] = await pool.query(
            `SELECT
                ci.product_id,
                p.name,
                p.price,
                p.image,
                p.stock,
                ci.quantity,
                (p.price * ci.quantity) AS subtotal
            FROM cart_items ci
            JOIN products p ON p.id = ci.product_id
            WHERE ci.cart_id = ?
            ORDER BY ci.created_at DESC`,
            [carts[0].id]
        );

        const total = items.reduce(
            (sum, item) => sum + Number(item.subtotal),
            0
        );

        return res.status(200).json({
            items,
            total
        });
    } catch (err) {
        console.error('Gagal mengambil keranjang:', err);

        return res.status(500).json({
            message: 'Gagal mengambil keranjang belanja'
        });
    }
};

const addCartItem = async (req, res) => {
    const { product_id, quantity = 1 } = req.body;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const cartId = await getOrCreateCart(
            connection,
            req.user.id
        );

        const [products] = await connection.query(
            'SELECT id, stock FROM products WHERE id = ? FOR UPDATE',
            [product_id]
        );

        if (products.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                message: 'Produk tidak ditemukan'
            });
        }

        const stock = Number(products[0].stock);

        const [existing] = await connection.query(
            `SELECT quantity
            FROM cart_items
            WHERE cart_id = ? AND product_id = ?`,
            [cartId, product_id]
        );

        const currentQuantity = existing.length
            ? Number(existing[0].quantity)
            : 0;

        if (currentQuantity + quantity > stock) {
            await connection.rollback();

            return res.status(400).json({
                message: 'Jumlah produk melebihi stok yang tersedia',
                stock,
                quantity_in_cart: currentQuantity
            });
        }

        await connection.query(
            `INSERT INTO cart_items
                (cart_id, product_id, quantity)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                quantity = quantity + VALUES(quantity)`,
            [cartId, product_id, quantity]
        );

        await connection.commit();

        return res.status(201).json({
            message: 'Produk berhasil ditambahkan ke keranjang'
        });
    } catch (err) {
        if (connection) {
            await connection.rollback();
        }

        console.error('Gagal menambah item keranjang:', err);

        return res.status(500).json({
            message: 'Gagal menambahkan produk ke keranjang'
        });
    } finally {
        if (connection) connection.release();
    }
};

const updateCartItem = async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;
    let connection;

    if (
        !Number.isSafeInteger(quantity) ||
        quantity <= 0
    ) {
        return res.status(400).json({
            message: 'quantity harus berupa bilangan bulat positif'
        });
    }

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [carts] = await connection.query(
            'SELECT id FROM carts WHERE user_id = ?',
            [req.user.id]
        );

        if (carts.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                message: 'Keranjang tidak ditemukan'
            });
        }

        const cartId = carts[0].id;

        const [products] = await connection.query(
            'SELECT stock FROM products WHERE id = ? FOR UPDATE',
            [productId]
        );

        if (products.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                message: 'Produk tidak ditemukan'
            });
        }

        const [items] = await connection.query(
            `SELECT id FROM cart_items
            WHERE cart_id = ? AND product_id = ?`,
            [cartId, productId]
        );

        if (items.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                message: 'Produk tidak ada di keranjang'
            });
        }

        if (quantity > Number(products[0].stock)) {
            await connection.rollback();

            return res.status(400).json({
                message: 'Jumlah produk melebihi stok yang tersedia',
                stock: Number(products[0].stock)
            });
        }

        await connection.query(
            `UPDATE cart_items
            SET quantity = ?
            WHERE cart_id = ? AND product_id = ?`,
            [quantity, cartId, productId]
        );

        await connection.commit();

        return res.status(200).json({
            message: 'Jumlah produk berhasil diperbarui'
        });
    } catch (err) {
        if (connection) await connection.rollback();

        console.error('Gagal memperbarui keranjang:', err);

        return res.status(500).json({
            message: 'Gagal memperbarui keranjang'
        });
    } finally {
        if (connection) connection.release();
    }
};

const removeCartItem = async (req, res) => {
    try {
        const [result] = await pool.query(
            `DELETE ci FROM cart_items ci
            JOIN carts c ON c.id = ci.cart_id
            WHERE c.user_id = ? AND ci.product_id = ?`,
            [req.user.id, req.params.productId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Produk tidak ditemukan di keranjang'
            });
        }

        return res.status(200).json({
            message: 'Produk berhasil dihapus dari keranjang'
        });
    } catch (err) {
        console.error('Gagal menghapus item:', err);

        return res.status(500).json({
            message: 'Gagal menghapus produk dari keranjang'
        });
    }
};

const clearCart = async (req, res) => {
    try {
        await pool.query(
            `DELETE ci FROM cart_items ci
            JOIN carts c ON c.id = ci.cart_id
            WHERE c.user_id = ?`,
            [req.user.id]
        );

        return res.status(200).json({
            message: 'Keranjang berhasil dikosongkan'
        });
    } catch (err) {
        console.error('Gagal mengosongkan keranjang:', err);

        return res.status(500).json({
            message: 'Gagal mengosongkan keranjang'
        });
    }
};

module.exports = {
    getCart,
    addCartItem,
    updateCartItem,
    removeCartItem,
    clearCart
};
