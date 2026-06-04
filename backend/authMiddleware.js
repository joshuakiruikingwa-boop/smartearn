const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access Denied: No Token Provided' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        req.user.id = verified.userId; // Ensure .id is available for all controllers
        next();
    } catch (err) {
        res.status(403).json({ message: 'Invalid Token' });
    }
};