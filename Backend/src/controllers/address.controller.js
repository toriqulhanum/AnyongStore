const db = require('../config/database');
const pool = db.promise();

const createAddress = async (req, res) => {
    let connection;

    try {
        const {
            recipient_name,
            phone,
            province,
            city,
            district,
            postal_code,
            address_detail,
            is_default
        } = req.body;

        const requiredFields = {
            recipient_name,
            phone,
            province,
            city, 
            district,
            postal_code,
            address_detail
        };

        for (const [field, value] of Object.entries(requiredFields)) {
            if (typeof value !== 'string' || !value.trim()) {
                return res.status(400).json({
                    message: `${field} wajib diisi` 
                });
            }
        }

        if (
            is_default !== undefined &&
            typeof is_default !== 'boolean'
        ) {
            return res.status(400).json({
                message: 'is_default harus berupa true or false'
            });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [addresses] = await connection.query(
            `SELECT id
            FROM user_addresses
            WHERE user_id = ?
            FOR UPDATE`,
            [req.user.id]
        );

        const makeDefault =
            is_default === true || addresses.length === 0;

        if (makeDefault) {
            await connection.query(
                `UPDATE user_addresses
                SET is_default = FALSE
                WHERE user_id = ?`,
                [req.user.id]
            );
        }

        const [result] = await connection.query(
            `INSERT INTO user_addresses
            (
                user_id,
                recipient_name,
                phone,
                province,
                city,
                district,
                postal_code,
                address_detail,
                is_default
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                recipient_name.trim(),
                phone.trim(),
                province.trim(),
                city.trim(),
                district.trim(),
                postal_code.trim(),
                address_detail.trim(),
                makeDefault,
            ]
        );

        await connection.commit();

        const [newAddress] = await pool.query(
            `SELECT * FROM user_addresses
            WHERE id = ? AND user_id = ?`,
            [result.insertId, req.user.id]
        );

        return res.status(201).json({
            message: 'Alamat berhasil ditambahkan',
            address: newAddress[0]
        });
    } catch (err) {
        console.error('create address error:', err)
        return res.status(500).json({
            message: 'Terjadi kesalahan pada server'
        });
        
    } finally {
        if (connection) 
            connection.release();
    }
};

const getAddresses = async (req, res) => {
    try {
        const [addresses] = await pool.query(
            `SELECT * FROM user_addresses
            WHERE user_id = ?
            ORDER BY is_default DESC, id DESC`,
            [req.user.id]
        );

        return res.status(200).json({
            message: 'Daftar alamat berhasil diambil',
            total_addresses: addresses.length,
            addresses
        });
    } catch (error) {
        console.error('Get addresses error:', error);
        return res.status(500).json({
            message: 'Terjadi kesalahan pada server'
        });
    }
};

const getAddressById = async (req, res) => {
    try {
        const [addresses] = await pool.query(
            `SELECT * FROM user_addresses
            WHERE id = ? AND user_id = ?`,
            [req.params.id, req.user.id]
        );

        if (addresses.length === 0) {
            return res.status(404).json({
                message: 'alamat tidak ditemukan'
            });
        }

        return res.status(200).json({
            message: 'Alamat berhasil ditemukan',
            address: addresses[0]
        });
    } catch (error) {
        console.error('Get address detail error:', err);
        return res.status(500).json({
            message: 'Terjadi kesalahan pada server'
        });
    }
};

const updateAddress = async (req, res) => {
    let connection;

    try {
        const allowedFields = [
            'recipient_name',
            'phone',
            'province',
            'city',
            'district',
            'postal_code',
            'address_detail',
        ];

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                const value = req.body[field];
                
                if (typeof value !== 'string' || !value.trim()) {
                    return res.status(400).json({
                        message: `${field} harus berupa teks dan tidak boleh kosong`
                    });
                }

                updates.push(`${field} = ?`);
                values.push(value.trim());
            }
        }

        if (req.body.is_default !== undefined) {
            if (typeof req.body.is_default !== 'boolean') {
                return res.status(400).json({
                    message: 'is_default harus berupa true atau false'
                });
            }
        }

        if (
            updates.length === 0 &&
            req.body.is_default === undefined
        ) {
            return res.status(400).json({
                message: 'tidak ada data yang diperbarui'
            });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [addresses] = await connection.query(
            `SELECT id
            FROM user_addresses
            WHERE id = ? AND user_id = ?
            FOR UPDATE`,
            [req.params.id, req.user.id]
        );

        if (addresses.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                message: 'alamat tidak ditemukan'
            });
        }

        if (req.body.is_default === true) {
            await connection.query(
            `UPDATE user_addresses
            SET is_default = FALSE
            WHERE user_id = ?`,
            [req.user.id]
        );

            updates.push('is_default = TRUE');
        } else if (req.body.is_default === false) {
            updates.push('is_default = FALSE');
        }
        
        if (updates.length > 0) {
            values.push(req.params.id, req.user.id);

            await connection.query(
                `UPDATE user_addresses
                SET ${updates.join(', ')}
                WHERE id = ? AND user_id = ?`,
                values
            );
        }

        await connection.commit();

        const [updatedAddress] = await pool.query(
            `SELECT * FROM user_addresses
            WHERE id = ? AND user_id = ?`,
            [req.params.id, req.user.id]
        );

        return res.status(200).json({
            message: 'Alamat berhasil diperbarui',
            address: updatedAddress[0]
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error('Update address error:', err);
        return res.status(500).json({
            message: 'Terjadi kesalahan pada server'
        });
    } finally {
        if (connection) connection.release();
    }
};

const setDefaultAddress = async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [addresses] = await connection.query(
            `SELECT id 
            FROM user_addresses
            WHERE id = ? AND user_id = ?
            FOR UPDATE`,
            [req.params.id, req.user.id]
        );

        if (addresses.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                message: 'Alamat tidak ditemukan'
            });
        }

        await connection.query(
            `UPDATE user_addresses
            SET is_default = FALSE
            WHERE user_id = ?`,
            [req.user.id]
        );

        await connection.query(
            `UPDATE user_addresses
            SET is_default = TRUE
            WHERE id = ? AND user_id = ?`,
            [req.params.id, req.user.id]
        );

        await connection.commit();

        return res.status(200).json({
            message: 'Alamat utama berhasil ditambahkan',
            address_id: Number(req.params.id)
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error('Set default address error:', err);
        return res.status(500).json({
            message: 'Terjadi kesalahan pada server'
        });
    } finally {
        if (connection) connection.release();
    }
};

const deleteAddress = async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [addresses] = await connection.query(
            `SELECT id, is_default 
            FROM user_addresses
            WHERE id = ? AND user_id = ?
            FOR UPDATE`,
            [req.params.id, req.user.id]
        );

        if (addresses.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                message: 'Alamat tidak ditemukan'
            });
        }

        const wasDefault = Boolean(addresses[0].is_default);

        await connection.query(
            `DELETE FROM user_addresses
            WHERE id = ? AND user_id = ?`,
            [req.params.id, req.user.id]
        );

        if (wasDefault) {
            const [remainingAddresses] = await connection.query(
                `SELECT id FROM user_addresses
                WHERE user_id = ?
                ORDER BY id DESC
                LIMIT 1`,
                [req.user.id]
            );

            if (remainingAddresses.length > 0) {
                await connection.query(
                    `UPDATE user_addresses
                    SET is_default = TRUE
                    WHERE id = ? AND user_id = ?`,
                    [remainingAddresses[0].id, req.user.id]
                );
            }
        }

        await connection.commit();

        return res.status(200).json({
            message: 'Alamat berhasil dihapus'
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error('Delete address error:', err);
        return res.status(500).json({
            message: 'Terjadi kesalahan pada server'
        });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    createAddress,
    getAddresses, 
    getAddressById,
    updateAddress,
    setDefaultAddress,
    deleteAddress
}