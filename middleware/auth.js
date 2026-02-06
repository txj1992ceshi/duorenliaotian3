const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'replace-this-in-production';

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: '需要登录' });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded) return res.status(403).json({ error: '无效的令牌' });

    req.userId = decoded.userId;
    req.user = await User.findById(req.userId).select('-password').lean();
    next();
  } catch (err) {
    return res.status(403).json({ error: '无效的令牌' });
  }
}

module.exports = { generateToken, authenticateToken };