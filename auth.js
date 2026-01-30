const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../database');
const { generateToken } = require('../middleware/auth');
const authMiddleware = require('../middleware/auth');

// 用户注册
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 验证输入
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名和密码不能为空'
            });
        }

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({
                success: false,
                message: '用户名长度应为 3-20 个字符'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: '密码长度至少为 6 个字符'
            });
        }

        // 检查用户名是否已存在
        const existingUser = await db.get(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: '用户名已存在'
            });
        }

        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);

        // 创建用户
        const result = await db.run(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword]
        );

        res.json({
            success: true,
            message: '注册成功',
            user: {
                id: result.id,
                username
            }
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({
            success: false,
            message: '注册失败'
        });
    }
});

// 用户登录
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 验证输入
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名和密码不能为空'
            });
        }

        // 查找用户
        const user = await db.get(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }

        // 验证密码
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }

        // 生成 token
        const token = generateToken(user);

        res.json({
            success: true,
            message: '登录成功',
            token,
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({
            success: false,
            message: '登录失败'
        });
    }
});

// 获取用户信息
router.get('/user/profile', authMiddleware, async (req, res) => {
    try {
        const user = await db.get(
            'SELECT id, username, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('获取用户信息错误:', error);
        res.status(500).json({
            success: false,
            message: '获取用户信息失败'
        });
    }
});

module.exports = router;
