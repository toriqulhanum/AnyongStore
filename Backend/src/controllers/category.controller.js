const db = require("../config/database");

const getCategories = (req, res) => {
    const sql = "SELECT * FROM categories";

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                message: 'Gagal mengambil data kategori',
            });
        }

        res.json(results);
    });
};

module.exports = { getCategories }; 