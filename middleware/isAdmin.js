const User = require('../models/User');

async function isAdmin(req, res, next) {
  try {
    const uid = req.userId || (req.user && req.user._id);
    if (!uid) return res.status(401).json({ error: '需要登录' });

    const user = req.user || await User.findById(uid).select('role');
    if (user && user.role === 'admin') return next();

    return res.status(403).json({ error: '权限不足，仅限管理员访问' });
  } catch (err) {
    return res.status(500).json({ error: '服务器错误' });
  }
}

module.exports = isAdmin;