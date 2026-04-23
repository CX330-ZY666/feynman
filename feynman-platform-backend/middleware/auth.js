const jwt = require('jsonwebtoken');

// JWT 认证中间件
const auth = (req, res, next) => {
    // 支持两种认证方式，优先使用 Authorization Bearer，避免旧的 x-auth-token 干扰
    let token = null;
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
        }
    if (!token) {
        token = req.header('x-auth-token');
    }
    
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user; // 直接使用 decoded.user，而不是 decoded
        next();
    } catch (err) {
        // 区分不同类型的错误，提供更友好的错误信息
        if (err.name === 'TokenExpiredError') {
            console.error('Token verification error: jwt expired');
            return res.status(401).json({ 
                msg: 'Token has expired. Please login again.',
                error: 'TOKEN_EXPIRED'
            });
        } else if (err.name === 'JsonWebTokenError') {
            console.error('Token verification error: invalid token');
            return res.status(401).json({ 
                msg: 'Invalid token. Please login again.',
                error: 'INVALID_TOKEN'
            });
        } else {
        console.error('Token verification error:', err.message);
            return res.status(401).json({ 
                msg: 'Token verification failed',
                error: 'TOKEN_VERIFICATION_FAILED'
            });
        }
    }
};

module.exports = auth;

