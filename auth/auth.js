const jwt = require('jsonwebtoken');

const generateAccessToken = (user) => {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '15m',
  });
};

function authenticateToken(token, type = process.env.ACCESS_TOKEN_SECRET) {
  let result = null;
  jwt.verify(token, type, (err, user) => {
    if (err) return null;
    result = user;
  });
  return result;
}

module.exports = {
  generateAccessToken: generateAccessToken,
  authenticateToken: authenticateToken,
};
