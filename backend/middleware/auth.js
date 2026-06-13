const jwt = require('jsonwebtoken');

// Verify JWT token and attach user info to req.user
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;  // Attach user info to request
    next();              // Continue to the actual route
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Check if user has required role
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission' });
    }
    next();
  };
};

module.exports = { verifyToken, requireRole };