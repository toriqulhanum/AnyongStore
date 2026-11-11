
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const createToken = (user) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET belum dikonfigurasi');
    }

    return jwt.sign(
        {
            sub: String(user.id),
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
    );
};
const register = (req, res) => {
    const { name, email, password } = req.body;

    if (
        typeof name !== 'string' ||
        name.trim().length < 2 ||
        name.trim().length > 100
    ) {
        return res.status(400).json({
            message: 'Nama harus terdiri dari 2 sampai 100 karakter'
        });
    }

    if (
        typeof email !== 'string' ||
        email.length > 191 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
        return res.status(400).json({
            message: 'Format email tidak valid'
        });
    }

    if (
        typeof password !== 'string' ||
        password.length < 8 ||
        password.length > 72
    ) {
        return res.status(400).json({
            message: 'Password harus terdiri dari 8 sampai 72 karakter'
        });
    }

    const normalizedEmail = email.trim().toLowerCase();

    bcrypt.hash(password, 12, (hashError, passwordHash) => {
        if (hashError) {
            console.error('Gagal melakukan hashing password');

            return res.status(500).json({
                message: 'Gagal memproses pendaftaran'
            });
        }

        const sql = `
            INSERT INTO users (name, email, password_hash, role)
            VALUES (?, ?, ?, 'customer')
        `;

        db.query(
            sql,
            [name.trim(), normalizedEmail, passwordHash],
            (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({
                            message: 'Email sudah terdaftar'
                        });
                    }

                    console.error('Registrasi gagal:', err);

                    return res.status(500).json({
                        message: 'Gagal mendaftarkan pengguna'
                    });
                }

                return res.status(201).json({
                    message: 'Registrasi berhasil',
                    user: {
                        id: result.insertId,
                        name: name.trim(),
                        email: normalizedEmail,
                        role: 'customer'
                    }
                });
            }
        );
    });
};

const login = (req, res) => {
    const { email, password } = req.body;

    if (
        typeof email !== 'string' ||
        typeof password !== 'string' ||
        email.trim() === '' ||
        password === ''
    ) {
        return res.status(400).json({
            message: 'Email dan password wajib diisi'
        });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const sql = `
        SELECT id, name, email, password_hash, role
        FROM users
        WHERE email = ?
        LIMIT 1
    `;

    db.query(sql, [normalizedEmail], (err, results) => {
        if (err) {
            console.error('Login gagal:', err);

            return res.status(500).json({
                message: 'Terjadi kesalahan saat login'
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                message: 'Email atau password salah'
            });
        }

        const user = results[0];

        bcrypt.compare(password, user.password_hash, (compareError, isMatch) => {
            if (compareError) {
                console.error('Pemeriksaan password gagal');

                return res.status(500).json({
                    message: 'Terjadi kesalahan saat login'
                });
            }

            if (!isMatch) {
                return res.status(401).json({
                    message: 'Email atau password salah'
                });
            }

            try {
                const token = createToken(user);

                return res.status(200).json({
                    message: 'Login berhasil',
                    token,
                    tokenType: 'Bearer',
                    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    }
                });
            } catch (tokenError) {
                console.error('Pembuatan token gagal:', tokenError.message);

                return res.status(500).json({
                    message: 'Gagal membuat token autentikasi'
                });
            }
        });
    });
};

const getMe = (req, res) => {
    const sql = `
        SELECT id, name, email, role, created_at
        FROM users
        WHERE id = ?
        LIMIT 1
    `;

    db.query(sql, [req.user.id], (err, results) => {
        if (err) {
            console.error('Gagal mengambil profil:', err);

            return res.status(500).json({
                message: 'Gagal mengambil profil pengguna'
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                message: 'Pengguna tidak ditemukan'
            });
        }

        return res.status(200).json({
            user: results[0]
        });
    });
};

module.exports = {
    register,
    login,
    getMe
};
