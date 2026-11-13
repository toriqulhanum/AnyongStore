const db = require('../config/database');
const pool = db.promise();
const crypto = require('crypto');

const createPayment = async (req, res) => {
    const {order_id, payment_method} = req.body;

    const allowedMethods = [
        'bank_transfer',
        'e_wallet',
        'virtual_account'
    ];

    if (
        !Number.isSafeInteger(order_id) ||
        order_id <= 0
    ) {
        return res.status(400).json({
            message: 'order ID harus berupa bilangan bulat positif'
        });
    }

    if (
        typeof payment_method !== 'string' ||
        !allowedMethods.includes(payment_method)
    ) {
        return res.status(400).json({
            message: 'metode pembayaran tidak valid',
            allowed_methods: allowedMethods
        });
    }

    let connection;
    let transactionStarted = false;

    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        const [orders] = await connection.query(
            `SELECT id, user_id, total_amount, status
            FROM orders
            WHERE id = ? AND user_id = ?`,
            [order_id, req.user.id]
        );

        if (orders.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                message: 'pesanan tidak ditemukan'
            });
        }

        const order = orders[0];

        if (order.status !== 'pending') {
            await connection.rollback();
            transactionStarted = false;

            return res.status(400).json({
                message: 'pesanan tidak dapat dibayar',
                order_status: order.status
            });
        }

        const [existingPayments] = await connection.query(
            `SELECT id, status
            FROM payments
            WHERE order_id = ?`,
            [order_id]
        );

        if (existingPayments.length > 0) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(409).json({
                message: 'pembayaran untuk pesanan ini telah dibuat',
                payment: existingPayments[0]
            });
        }

        const transactionCode = 
            'PAY-' + crypto.randomBytes(8).toString('hex').toUpperCase();

            const [result] = await connection.query(
                `INSERT INTO payments
                    (order_id, payment_method, amount, status,
                    transaction_code, expires_at)
                VALUES (?, ?, ?, 'pending', ?, 
                    DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
                [
                    order_id,
                    payment_method,
                    order.total_amount,
                    transactionCode
                ]
            );

            const [payments] = await connection.query(
                `SELECT
                    id, 
                    order_id,
                    payment_method,
                    amount, 
                    status,
                    transaction_code,
                    expires_at,
                    created_at
                FROM payments
                WHERE id = ?`,
                [result.insertId]
            );

            await connection.commit();
            transactionStarted = false;

            return res.status(200).json({
                message: 'pembayaran berhasil dibuat',
                payment: payments[0]
            });
    } catch (err) {
        if (connection && transactionStarted) {
            await connection.rollback();
            transactionStarted = false;
        };

        console.error('Gagal membuat pembayaran:', err)

        return res.status(500).json({
            message: 'Gagal membuat pembayaran'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

const getMyPayments = async (req, res) => {
    try {
        const [payments] = await pool.query(
            `SELECT
                p.id,
                p.order_id,
                p.payment_method,
                p.amount,
                p.status,
                p.transaction_code,
                p.paid_at,
                p.expires_at,
                p.created_at, 
                o.status AS order_status
            FROM payments p
            JOIN orders o ON o.id = p.order_id
            WHERE o.user_id = ? 
            ORDER BY p.created_at DESC`,
            [req.user.id]
        );

        return res.status(200).json({
            message: 'Riwayat pembayaran berhasil diambil',
            total_payments: payments.length,
            payments
        });
    } catch (err) {
        console.error('Gagal mengambil riwayat pembayaran:', err);

        return res.status(500).json({
            message: 'Gagal mengambil riwayat pembayaran'
        });
    }
};

const getPaymentById = async (req, res) => {
    const { id } = req.params;

    if (!/^[1-9]\d*$/.test(id)) {
        return res.status(400).json({
            message: 'ID pembayaran tidak valid'
        });
    }

    try {
        const [payments] = await pool.query(
            `SELECT
                p.id,
                p.order_id,
                p.payment_method,
                p.amount,
                p.status,
                p.transaction_code,
                p.paid_at,
                p.expires_at,
                p.created_at,
                o.status AS order_status
            FROM payments p
            JOIN orders o ON o.id = p.order_id
            WHERE p.id = ? AND o.user_id = ?`,
            [id, req.user.id]
        );

        if (payments.length === 0) {
            return res.status(404).json({
                message: 'Pembayaran tidak ditemukan'
            });
        }

        return res.status(200).json({
            message: 'Detail pembayaran berhasil diambil',
            payment: payments[0]
        });

    } catch (err) {
        console.error('Gagal mengambil detail pembayaran:', err);

        return res.status(500).json({
            message: 'Gagal mengambil detail pembayaran'
        });
    }
};

const simulatePayment = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const paymentId = Number(req.params.id)
        const {result} = req.body;

        if (!Number.isSafeInteger(paymentId) || paymentId <= 0) {
            return res.status(400).json({
                message: 'ID pembayaran tidak valid'
            });
        }

        const allowedResults = ['paid', 'failed', 'expired'];

        if (!allowedResults.includes(result)) {
            return res.status(400).json({
                message: 'hasil simulasi harus paid, failed, atau expired'
            });
        }

        await connection.beginTransaction();

        const [payments] = await connection.execute(
            `SELECT 
                p.id,
                p.order_id,
                p.status AS payment_status,
                p.expires_at,
                o.status AS order_status,
                (p.expires_at < NOW()) AS is_expired
            FROM payments p
            JOIN orders o ON o.id = p.order_id
            WHERE p.id = ?
            FOR UPDATE`,
            [paymentId]
        );

        if (payments.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                message: 'pembayaran tidak ditemukan'
            });
        }

        const payment = payments[0];
            
        if (payment.payment_status !== 'pending') {
            await connection.rollback();

            return res.status(400).json({
                message: 'pembayaran sudah diproses sebelumnya'
            });
        }

        if (payment.order_status !== 'pending') {
            await connection.rollback();

            return res.status(400).json({
                message: 'pesanan tidak dalam status pending'
            });
        }

        if (result === 'expired' && !payment.is_expired) {
            await connection.rollback();

            return res.status(400).json({
                message: 'waktu pembayaran belum expired'
            });
        }

        if (result === 'paid') {
            if (payment.is_expired) {
                await connection.rollback();

                return res.status(400).json({
                    message: 'pembayaran sudah melewati batas waktu'
                });
            }

            await connection.execute(
                `UPDATE payments
                SET status = 'paid', paid_at = NOW()
                WHERE id = ?`,
                [paymentId]
            );

            await connection.execute(
                `UPDATE orders
                SET status = 'processing'
                WHERE id = ?`,
                [payment.order_id]
            );
        }

        if (result === 'failed' || result === 'expired') {
            await connection.execute(
                `UPDATE payments
                SET status = ?
                WHERE id = ?`,
                [result, paymentId]
            );

            await connection.execute(
                `UPDATE orders
                SET status = 'cancelled'
                WHERE id = ?`,
                [payment.order_id]
            );

            await connection.execute(
                `UPDATE products p
                JOIN order_items oi ON p.id = oi.product_id
                SET p.stock = p.stock + oi.quantity
                WHERE oi.order_id = ?`,
                [payment.order_id]
            );
        }

        await connection.commit();

        return res.status(200).json({
            message: 'simulasi pembayaran berhasil',
            payment_id: paymentId,
            payment_status: result,
            order_id: payment.order_id,
            order_status: result === 'paid' ? 'processing' : 'cancelled'
        });
    } catch (error) {
        await connection.rollback();

        console.error('simulasi pembayaran gagal:', error);

        return res.status(500).json({
            message: 'Terjadi kesalahan pada server'
        });
    } finally {
        connection.release();
    }
};

module.exports = {
    createPayment,
    getMyPayments,
    getPaymentById,
    simulatePayment
}