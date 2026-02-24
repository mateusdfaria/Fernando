const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-bonsai-key-change-this-in-production';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];

    // The header format should be: Bearer TOKEN_STRING
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acesso negado. Token de autenticação não fornecido.' });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified; // Add the user payload to request
        next(); // Proceed to the protected route
    } catch (error) {
        return res.status(401).json({ error: 'Acesso negado. Token inválido ou expirado.' });
    }
}

function generateToken(user) {
    // Token is valid for 24 hours
    return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
}

module.exports = {
    authenticateToken,
    generateToken,
    JWT_SECRET
};
