const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const REFRESH_AUTH_HEADER = 'x-refresh-token';

// 用户注册
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 检查用户是否已存在
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'Email already exists' });
        }
        
        user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ msg: 'Username already exists' });
        }

        // 创建新用户
        user = new User({ username, email, password });

        // 加密密码
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        // 生成访问令牌与刷新令牌
        const payload = { user: { id: user.id } };
        const accessExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
        const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
        const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: accessExpiresIn });
        const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: refreshExpiresIn });

        res.json({ token, refreshToken });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 用户登录
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 查找用户
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // 验证密码
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // 生成访问令牌与刷新令牌
        const payload = { user: { id: user.id } };
        const accessExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
        const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
        const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: accessExpiresIn });
        const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: refreshExpiresIn });

        res.json({ token, refreshToken });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 刷新访问令牌
router.post('/refresh', async (req, res) => {
    try {
        // 支持三种方式携带刷新令牌：
        // 1) Authorization: Bearer <refreshToken>
        // 2) x-refresh-token: <refreshToken>
        // 3) body.refreshToken
        let refreshToken = null;
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            refreshToken = authHeader.substring(7);
        }
        if (!refreshToken) {
            refreshToken = req.header(REFRESH_AUTH_HEADER);
        }
        if (!refreshToken && req.body && req.body.refreshToken) {
            refreshToken = req.body.refreshToken;
        }

        if (!refreshToken) {
            return res.status(400).json({ msg: 'No refresh token provided' });
        }

        const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, refreshSecret);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ msg: 'Refresh token expired', error: 'REFRESH_EXPIRED' });
            }
            return res.status(401).json({ msg: 'Invalid refresh token', error: 'REFRESH_INVALID' });
        }

        // 颁发新的访问令牌
        const payload = { user: { id: decoded.user.id } };
        const accessExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: accessExpiresIn });

        return res.json({ token });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 获取当前用户信息
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;