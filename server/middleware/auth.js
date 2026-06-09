const jwt = require('jsonwebtoken');

/**
 * verifyToken middleware
 * Reads the accessToken from the httpOnly cookie (set by the server on login/register).
 * Attaches decoded payload { id, role } to req.user.
 */
const verifyToken = (req, res, next) => {
  const token = req.cookies.accessToken;
  if (!token) {
    return res.status(401).json({ message: 'No access token. Please log in.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Access token invalid or expired.' });
  }
};

module.exports = verifyToken;
