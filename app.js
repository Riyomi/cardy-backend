require('dotenv').config();

const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const schema = require('./schema/schema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('./models/user');
const app = express();
const cors = require('cors');

mongoose.connect(
  'mongodb+srv://my-games-list-admin:LE7O5jstWV9PJcB2@mygameslist.elmu1.mongodb.net/cardy?retryWrites=true&w=majority'
);

mongoose.connection.once('open', () => {
  console.log('connected to database');
});

let refreshTokens = [];

app.use(
  cors({
    origin: 'http://localhost:3000',
  })
);

app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    graphiql: true,
  })
);

app.use(express.json());

app.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    try {
      const match = await bcrypt.compare(req.body.password, user.password);
      if (match) {
        const authenticatedUser = { id: user._id, email: user.email };

        const accessToken = generateAccessToken(authenticatedUser);
        const refreshToken = jwt.sign(
          authenticatedUser,
          process.env.REFRESH_TOKEN_SECRET
        );

        refreshTokens.push(refreshToken);

        return res.json({
          accessToken: accessToken,
          refreshToken: refreshToken,
        });
      } else {
        return res.status(401).send('validation failed');
      }
    } catch {
      return res.status(401).send('validation failed');
    }
  } catch {
    return res.status(400).send('Cannot find user');
  }
});

app.delete('/logout', (req, res) => {
  refreshTokens = refreshTokens.filter((token) => token !== req.body.token);
  res.sendStatus(204);
});

app.post('/token', (req, res) => {
  console.log(req.body.token);
  const refreshToken = req.body.token;
  if (refreshToken == null) return res.sendStatus(401);
  if (!refreshTokens.includes(refreshToken)) return res.sendStatus(403);
  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);

    const accessToken = generateAccessToken({ email: user.email });
    res.json({ accessToken: accessToken });
  });
});

function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '15s',
  });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

app.listen(4000, () => {
  console.log('Listening on port 4000...');
});
