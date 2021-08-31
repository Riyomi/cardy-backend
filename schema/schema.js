require('dotenv').config();

const jwt = require('jsonwebtoken');

const graphql = require('graphql');
const bcrypt = require('bcrypt');
const Card = require('../models/card');
const Deck = require('../models/deck');
const User = require('../models/user');
const Category = require('../models/category');

const _ = require('lodash');

const {
  GraphQLObjectType,
  GraphQLString,
  GraphQLSchema,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
} = graphql;

const UserType = new GraphQLObjectType({
  name: 'User',
  fields: () => ({
    id: { type: GraphQLID },
    email: { type: GraphQLString },
    name: { type: GraphQLString },
    level: { type: GraphQLInt },
    experience: { type: GraphQLInt },
    followers: { type: new GraphQLList(UserType) },
    following: { type: new GraphQLList(UserType) },
    decks: {
      type: new GraphQLList(DeckType),
      resolve(parent, args) {
        return Deck.find({ userId: parent.id });
      },
    },
  }),
});

const DeckType = new GraphQLObjectType({
  name: 'Deck',
  fields: () => ({
    id: { type: GraphQLID },
    title: { type: GraphQLString },
    img: { type: GraphQLString },
    learners: { type: GraphQLList(GraphQLID) },
    category: {
      type: CategoryType,
      resolve(parent, args) {
        return Category.findById(parent.categoryId);
      },
    },
    createdBy: {
      type: UserType,
      resolve(parent, args) {
        return User.findById(parent.userId);
      },
    },
    user: {
      type: UserType,
      resolve(parent, args) {
        return User.findById(parent.userId);
      },
    },
    cards: {
      type: new GraphQLList(CardType),
      resolve(parent, args) {
        return Card.find({ deckId: parent.id });
      },
    },
  }),
});

const CardType = new GraphQLObjectType({
  name: 'Card',
  fields: () => ({
    id: { type: GraphQLID },
    front: { type: GraphQLString },
    back: { type: GraphQLString },
    step: { type: GraphQLInt },
    streak: { type: GraphQLInt },
    img: { type: GraphQLString },
    audio: { type: GraphQLString },
    deck: {
      type: DeckType,
      resolve(parent, args) {
        3;
        return Deck.findById(parent.deckId);
      },
    },
  }),
});

const CategoryType = new GraphQLObjectType({
  name: 'Category',
  fields: () => ({
    id: { type: GraphQLID },
    name: { type: GraphQLString },
  }),
});

const RootQuery = new GraphQLObjectType({
  name: 'RootQueryType',
  fields: {
    user: {
      type: UserType,
      args: { id: { type: GraphQLID } },
      resolve(parent, args) {
        return User.findById(args.id);
      },
    },
    deck: {
      type: DeckType,
      args: { id: { type: GraphQLID } },
      resolve(parent, args) {
        return Deck.findById(args.id);
      },
    },
    card: {
      type: CardType,
      args: { id: { type: GraphQLID } },
      resolve(parent, args) {
        return Card.findById(args.id);
      },
    },
    users: {
      type: GraphQLList(UserType),
      resolve(parent, args) {
        return User.find({});
      },
    },
    categories: {
      type: GraphQLList(CategoryType),
      resolve(parent, args) {
        return Category.find({});
      },
    },
    // users: {
    //   type: GraphQLList(UserType),
    //   resolve(parent, args, context) {
    //     const authHeader = context.headers['authorization'];
    //     const token = authHeader && authHeader.split(' ')[1];

    //     console.log(token);

    //     if (token == null) return null;

    //     let users = null;

    //     jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    //       if (err) {
    //         users = err;
    //         return;
    //       }

    //       users = User.find({});
    //     });

    //     return users;
    //   },
    // },
    decks: {
      type: GraphQLList(DeckType),
      resolve(parent, args) {
        return Deck.find({ isPublic: true });
      },
    },
    cards: {
      type: GraphQLList(CardType),
      resolve(parent, args) {
        return Card.find({});
      },
    },
  },
});

const Mutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    createUser: {
      type: UserType,
      args: {
        email: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
      },
      async resolve(parent, args) {
        try {
          const hashedPassword = await bcrypt.hash(args.password, 10);
          const user = { email: args.email, password: hashedPassword };
          console.log(hashedPassword);
          return User(user).save();
        } catch (e) {
          console.log(e);
        }
      },
    },
    // changeDeck: {
    //   args: {
    //     deckId: { type: new GraphQLNonNull(GraphQLString) },
    //   },
    //   async resolve(parent, args, context) {
    //     try {

    //     }
    //   }
    // },
  },
});

module.exports = new GraphQLSchema({
  query: RootQuery,
  mutation: Mutation,
});
