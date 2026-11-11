const express = require('express');
const db = require('./config/database')

const productRoute = require('./routes/product.route');
const categoryRoutes = require('./routes/category.route');
const authRoutes = require('./routes/auth.route');
const cartRoutes = require('./routes/cart.route');
const orderRoutes = require('./routes/order.route');

const app = express();

app.use(express.json());

db.query('SELECT 1', (err) => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Database connection successful');
    }
});

app.use('/api/products', productRoute);
app.use('/api/categories', categoryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

app.get('/', (req, res) => {
    res.send('AnyongStore API is running!');
});

module.exports = app;