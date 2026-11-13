const db = require('../config/database');
const pool = db.promise();

const checkout = async (req, res) => {
    const {shipping_address} = req.body;
    let connection;
    let transactionStarted = false;

    if (
        typeof shipping_address !== 'string' ||
        shipping_address.trim().length < 10
    ) {
        return res.status(400).json({
            message: 'Alamat pengiriman harus terdiri dari minimal 10 karakter'
        });
    }

    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        const [carts] = await connection.query(
            `SELECT id FROM carts WHERE user_id = ? FOR UPDATE`,
            [req.user.id]
        );

        if (carts.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                message: 'keranjang masih kosong'
            });
        }

        const cartId = carts[0].id;

        const [items] = await connection.query(
            `SELECT ci.product_id, ci.quantity, p.name, p.price, p.stock
            FROM cart_items ci
            JOIN products p ON p.id = ci.product_id
            WHERE ci.cart_id = ?
            FOR UPDATE`,
            [cartId]
        );

        if (items.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                message: 'keranjang belanja masih kosong'
            });
        }

        let totalCents = 0n;

        const orderItems = [];

        for (const item of items) {
            const quantity = Number(item.quantity);
            const stock = Number(item.stock);

            if (
                !Number.isSafeInteger(quantity) ||
                quantity <= 0
            ) {
                throw new Error('quantity produk tidak valid');
            }

            if (quantity > stock) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(400).json({
                    message: `stok produk ${item.name}tidak mencukupi`,
                    product_id: item.product_id,
                    stock,
                    requested_quantity: quantity
                });
            }

            const priceParts = String(item.price).split('.');
            const priceCents = 
                BigInt(priceParts[0]) * 100n +
                BigInt((priceParts[1] || '').padEnd(2, '0').slice(0, 2));

            const subtotalCents = priceCents * BigInt(quantity);

            totalCents += subtotalCents;

            orderItems.push({
                product_id: item.product_id,
                product_name: item.name,
                price: String(item.price),
                quantity,
                subtotal: subtotalCents
            });
        }

        const formatMoney = (cents) => {
            const whole = cents / 100n;
            const fraction = (cents % 100n)
                .toString()
                .padStart(2, '0');

            return `${whole}.${fraction}`;
        };

        const [orderResult] = await connection.query(
            `INSERT INTO orders
                (user_id, total_amount, status, shipping_address)
            VALUES (?, ?, 'pending', ?)`,
            [
                req.user.id,
                formatMoney(totalCents),
                shipping_address.trim()
            ]
        );

        const orderId = orderResult.insertId;

        for (const item of orderItems) {
            await connection.query(
                `INSERT INTO order_items
                    (order_id, product_id, product_name, price, quantity, subtotal)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    orderId,
                    item.product_id,
                    item.product_name,
                    item.price,
                    item.quantity,
                    formatMoney(item.subtotal)
                ]
            );
        }

        for (const item of orderItems) {
            const [updateResult] = await connection.query(
                `UPDATE products
                SET stock = stock - ?
                WHERE id = ? AND stock >= ?`,
                [
                    item.quantity, 
                    item.product_id, 
                    item.quantity
                ]
            );

            if  (updateResult.affectedRows === 0) {
                throw new Error(`gagal memperbarui stok produk ${item.product_name}`
                );
            }
        }

        await connection.query(
            `DELETE FROM cart_items WHERE cart_id = ?`,
            [cartId]
        );

        await connection.commit(),
        transactionStarted = false;

        return res.status(201).json({
            message: 'checkout berhasil, pesanan berhasil dibuat',
            order: {
                id: orderId,
                total: formatMoney(totalCents),
                status: 'pending',
                shipping_address: shipping_address.trim(),
                items: orderItems.map(item => ({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    price: item.price,
                    quantity: item.quantity,
                    subtotal: formatMoney(item.subtotal)
                }))
            }
        });
    } catch (err) {
        if (connection && transactionStarted) {
            await connection.rollback();
            transactionStarted = false;
        }

        console.error('Gagal melakukan checkout:', err);

        return res.status(500).json({
            message: 'Terjadi kesalahan saat melakukan checkout'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

const getMyOrders = async (req, res) => {
    try {
        const [orders] = await pool.query(
            `SELECT 
                id, 
                total_amount,
                status, 
                shipping_address,
                created_at,
                updated_at
            FROM orders
            WHERE user_id = ?
            ORDER BY created_at DESC`,
            [req.user.id]
        );

        if (orders.length === 0) {
            return res.status(200).json({
                message: 'belum ada riwayat pesanan',
                orders: []
            });
        }

        const orderIds = orders.map(order => order.id)
        const placeholders = orderIds.map(() => '?').join(', ');

        const [items] = await pool.query(
            `SELECT
                order_id,
                product_id,
                product_name,
                price,
                quantity, 
                subtotal
            FROM order_items
            WHERE order_id IN (${placeholders})
            ORDER BY id DESC`,
            orderIds
        );

        const groupedItems  = {};

        for (const item of items) {
            if(!groupedItems[item.order_id]) {
                groupedItems[item.order_id] = [];
            }

            groupedItems[item.order_id].push({
                product_id: item.product_id,
                product_name: item.product_name,
                price: item.price,
                quantity: item.quantity,
                subtotal: item.subtotal
            });
        }

        const results = orders.map(order => ({
            ...order,
            items: groupedItems[order.id] || []
        }));

        return res.status(200).json({
            message: 'berhasil mendapatkan riwayat pesanan',
            orders: results
        });

    } catch (err) {
        console.error('Gagal mendapatkan riwayat pesanan', err);

        return res.status(500).json({
            message: 'Gagal mengambil riwayat pesanan'
        });
    }
};

const getOrderById  = async (req, res) => {
    const {id} = req.params;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({
            message: 'ID pesanan tidak valid'
        });
    }

    try {
        const [orders] = await pool.query(
            `SELECT
                id, 
                total_amount,
                status,
                shipping_address,
                created_at,
                updated_at
            FROM orders
            WHERE id = ? AND user_id = ?`,
            [id, req.user.id]
        );

        if (orders.length === 0) {
            return res.status(404).json({
                message: 'pesanan tidak ditemukan'
            });
        }

        const order = orders[0];

        const [items] = await pool.query(
            `SELECT
                product_id,
                product_name,
                price,
                quantity,
                subtotal
            FROM order_items
            WHERE order_id = ?
            ORDER BY id ASC`,
            [id]
        );

        return res.status(200).json({
            message: 'berhasil mengambil detail pesanan',
            order: {
                ...order,
                items
            }
        });
    } catch (err) {
        console.error('Gagal mengambil detail pesanan', err);

        return res.status(500).json({
            message: 'Gagal mengambil detail pesanan'
        });
    }
};

const getAllOrders = async (req, res) => {
    try {
        const [orders] = await pool.query(
            `SELECT
                o.id,
                o.user_id,
                u.name AS customer_name,
                u.email AS customer_email,
                o.total_amount,
                o.status,
                o.shipping_address,
                o.created_at,
                o.updated_at
            FROM orders o
            JOIN users u ON u.id = o.user_id
            ORDER BY o.created_at DESC`
        );

        return res.status(200).json({
            message: 'berhasil mendapatkan riwayat pesanan',
            total_orders: orders.length,
            orders
        });
    } catch (err) {
        console.error('Gagal mengambil riwayat pesanan:', err)

        return res.status(500).json({
            message: 'Gagal mengambil riwayat pesanan'
        });
    }
};

const getOrderDetailAdmin = async (req, res) => {
    const {id} = req.params;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({
            message: 'ID pesanan tidak valid'
        });
    }

    try {
        const [orders] = await pool.query(
            `SELECT
                o.id,
                o.user_id,
                u.name AS customer_name,
                u.email AS customer_email,
                o.total_amount,
                o.status,
                o.shipping_address,
                o.created_at,
                o.updated_at
            FROM orders o
            JOIN users u ON u.id = o.user_id
            WHERE o.id = ?`,
            [id]
        );

        if (orders.length === 0) {
            return res.status(404).json({
                message: 'pesanan tidak ditemukan'
            });
        }

        const [items] = await pool.query(
            `SELECT 
                product_id,
                product_name,
                price,
                quantity,
                subtotal
            FROM order_items
            WHERE order_id = ?
            ORDER BY id ASC`,
            [id]
        );

        return res.status(200).json({
            message: 'berhasil mengambil detail pesanan',
            order: {
                ...orders[0],
                items
            }
        });
    } catch (err) {
        console.error('Gagal mengambil detail pesanan admin:', err);

        return res.status(500).json({
            message: 'Gagal mengambil detail pesanan'
        });
    }
};

const updateOrderStatus = async (req, res) => {
    const {id} = req.params;
    const {status} = req.body;

    const allowedTransitions = {
        pending: ['processing', 'cancelled'],
        processing: ['shipped', 'cancelled'],
        shipped: ['completed'],
        completed: [],
        cancelled: []
    };

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({
            message: 'ID pesanan tidak valid'
        });
    }

    const validStatuses = [
        'pending',
        'processing',
        'shipped',
        'completed',
        'cancelled'
    ];

    if (
        typeof status !== 'string' ||
        !validStatuses.includes(status)
    ) {
        return res.status(400).json({
            message: 'status pesanan tidak valid',
            allowed_statuses: validStatuses
        });
    }

    let connection;
    let transactionStarted = false;

    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        const [orders] = await connection.query(
            `SELECT id, status
            FROM orders
            WHERE id = ?
            FOR UPDATE`,
            [id]
        );

        if (orders.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                message: 'pesanan tidak ditemukan'
            });
        }

        const currentStatus = orders[0].status;

        if (!allowedTransitions[currentStatus].includes(status)) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(400).json({
                message: 'perubahan status pesanan tidak diperbolehkan',
                current_status: currentStatus,
                requested_status: status
            });
        }

        if (status === 'cancelled') {
            const [items] = await connection.query(
                `SELECT product_id, quantity
                FROM order_items
                WHERE order_id = ?
                ORDER BY product_id ASC
                FOR UPDATE`,
                [id]
            );

            for (const item of items) {
                await connection.query(
                    `UPDATE products
                    SET stock = stock + ?
                    WHERE id = ?`,
                    [item.quantity, item.product_id]
                );
            }
        }

        await connection.query(
            `UPDATE orders
            SET status = ?
            WHERE id = ?`,
            [status, id]
        );

        await connection.commit();
        transactionStarted = false;

        return res.status(200).json({
            message: 'status pesanan berhasil diubah',
            order: {
                id: Number(id),
                previous_Status: currentStatus,
                current_status: status
            }
        });
    } catch (err) {
        if (connection && transactionStarted) {
            await connection.rollback();
            transactionStarted = false;
        }

        console.error('Gagal mengubah status pesanan:', err)

        return res.status(500).json({
            message: 'Gagal mengubah status pesanan'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = {
    checkout,
    getMyOrders,
    getOrderById,
    getAllOrders,
    getOrderDetailAdmin, 
    getAllOrders,
    getOrderDetailAdmin,
    updateOrderStatus
};