
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'Token autentikasi diperlukan'
        });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
        return res.status(401).json({
            message: 'Token autentikasi diperlukan'
        });
    }

    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET belum dikonfigurasi');

        return res.status(500).json({
            message: 'Konfigurasi autentikasi belum tersedia'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                message: 'Token tidak valid atau sudah kedaluwarsa'
            });
        }

        req.user = {
            id: decoded.sub,
            role: decoded.role
        };

        next();
    });
};

const authorizeRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (
            !req.user ||
            !allowedRoles.includes(req.user.role)
        ) {
            return res.status(403).json({
                message: 'Kamu tidak memiliki izin untuk mengakses resource ini'
            });
        }

        next();
    };
};

module.exports = {
    authenticateToken,
    authorizeRole
};
