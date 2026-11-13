const db = require('../config/database');
const pool = db.promise();

const getProfile = async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT id, name, email, role, created_at
            FROM users
            WHERE id = ?`,
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: 'pengguna tidak ditemukan'
            });
        }

        res.status(200).json({
            message: 'profil berhasil ditemukan',
            profile: users[0]
        });
    } catch (err) {
        console.error('Get profile error:', err)
        res.status(500).json({
            message: 'terjadi kesalahan pada server'
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { name, email } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                message: 'nama dan email wajib diisi'
            });
        }

        if (
            typeof name !== 'string' ||
            typeof email !== 'string' ||
            !name.trim() ||
            !email.trim()
        ) {
            return res.status(400).json({
                message: 'nama dan email harus berupa teks yang valid'
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({
                message: 'format email tidak valid'
            });
        }

        const [existingEmail] = await pool.query(
            `SELECT id 
            FROM users
            WHERE email = ? AND id != ?`,
            [cleanEmail, req.user.id]
        );

        if (existingEmail.length > 0) {
            return res.status(409).json({
                message: 'email sudah terdaftar'
            });
        }

        await pool.query(
            `UPDATE users
            SET name = ?, email = ?
            WHERE id = ?`,
            [cleanName, cleanEmail, req.user.id]
        );

        const [updateUsers] = await pool.query(
            `SELECT id, name, email, role, created_at
            FROM users
            WHERE id = ?`,
            [req.user.id]
        );

        return res.status(200).json({
            message: 'profil berhasil diperbarui',
            profile: updateUsers[0]
        });
    } catch (err) {
        console.error('Update profile error:'. err)

        return res.status(500).json({
            message: 'terjadi kesalahan pada server'
        });
    }
};

module.exports = {
    getProfile,
    updateProfile
};