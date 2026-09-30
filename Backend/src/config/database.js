const mysql = require('mysql2');

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'haNUM321.$',
    database: 'AnyongStore'
})

module.exports = db;