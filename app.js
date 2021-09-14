require('dotenv').config();

const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const schema = require('./schema/schema');
const mongoose = require('mongoose');
const app = express();
const cors = require('cors');
const cookieParser = require('cookie-parser');

mongoose.connect(
  `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@mygameslist.elmu1.mongodb.net/cardy?retryWrites=true&w=majority`
);

mongoose.connection.once('open', () => {
  console.log('connected to database');
});

app.use(
  cors({
    origin: process.env.DEVELOPER
      ? 'http://localhost:3000'
      : 'https://alpha-cardy.netlify.app',
    credentials: true,
  })
);

app.use(cookieParser());

app.use('/graphql', (req, res) => {
  return graphqlHTTP({
    schema,
    graphiql: true,
    context: { req, res, token: getToken(req) },
  })(req, res);
});

app.use(express.json());

app.listen(process.env.PORT || 4000, () => {
  console.log('Listening on port 4000...');
});

function getToken(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  return token;
}
