const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
const { pool } = require('./config/db'); // Destructure to get the actual pool instance

const app = express();

// Test PostgreSQL connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error connecting to PostgreSQL:', err);
    } else {
        console.log('PostgreSQL connected successfully at', res.rows[0].now);
    }
});

app.use(cors());
app.use(express.json());

// Import Routes
const userRoutes = require('./routes/users');
const taskRoutes = require('./routes/taskRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const pesapal = require('./pesapal');
const authMiddleware = require('./authMiddleware');

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.static(path.join(__dirname, '..', 'user')));

// Serve the main index page at the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/auth', authRoutes);
app.use('/admin', adminRoutes);

// PesaPal Payment Routes
app.post('/api/payments/pesapal/submit-order', authMiddleware, pesapal.submitOrder);
app.get('/api/payments/pesapal/ipn', pesapal.handleIPN);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});