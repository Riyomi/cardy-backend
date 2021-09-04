require('dotenv').config();
const generateAccessToken = require('../auth/auth');

const jwt = require('jsonwebtoken');

const graphql = require('graphql');
const bcrypt = require('bcrypt');
const Card = require('../models/card');
const Deck = require('../models/deck');
const User = require('../models/user');
const Category = require('../models/category');

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
    img: { type: GraphQLString },
    level: { type: GraphQLInt },
    experience: { type: GraphQLInt },
    followers: {
      type: new GraphQLList(UserType),
      async resolve(parent, args) {
        try {
          const user = await User.findById(parent.id);
          return await User.find({
            _id: { $in: user.followers },
          });
        } catch {
          throw new Error('database error');
        }
      },
    },
    following: {
      type: new GraphQLList(UserType),
      async resolve(parent, args) {
        try {
          const user = await User.findById(parent.id);
          return await User.find({
            _id: { $in: user.following },
          });
        } catch (e) {
          throw new Error('database error');
        }
      },
    },
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

const UserInfoType = new GraphQLObjectType({
  name: 'UserInfo',
  fields: () => ({
    user: { type: UserType },
    accessToken: { type: GraphQLString },
    refreshToken: { type: GraphQLString },
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
        name: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
        confirmPassword: { type: new GraphQLNonNull(GraphQLString) },
      },
      async resolve(parent, args) {
        if (!args.email) throw new Error('Email is required');
        if (!args.name) throw new Error('Name is required');
        if (!args.password) throw new Error('Password is required');

        if (args.password !== args.confirmPassword)
          throw new Error('Passwords do not match');

        try {
          const hashedPassword = await bcrypt.hash(args.password, 10);

          const user = {
            email: args.email,
            name: args.name,
            password: hashedPassword,
          };
          return User(user).save();
        } catch (e) {
          throw new Error('Server error');
        }
      },
    },
    loginUser: {
      type: UserInfoType,
      args: {
        email: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
      },
      async resolve(parent, args) {
        try {
          const user = await User.findOne({ email: args.email });

          try {
            const match = await bcrypt.compare(args.password, user.password);

            if (match) {
              const authenticatedUser = { id: user.id, email: user.email };
              const accessToken = generateAccessToken(authenticatedUser);
              const refreshToken = jwt.sign(
                authenticatedUser,
                process.env.REFRESH_TOKEN_SECRET
              );

              return {
                user: user,
                accessToken: accessToken,
                refreshToken: refreshToken,
              };
            } else {
              throw new Error('Email or password incorrect');
            }
          } catch {
            throw new Error('Email or password incorrect');
          }
        } catch {
          throw new Error('Email or password incorrect');
        }
      },
    },
    followUser: {
      type: UserType,
      args: {
        followerId: { type: new GraphQLNonNull(GraphQLID) },
        followingId: { type: new GraphQLNonNull(GraphQLID) },
      },
      async resolve(parent, args) {
        try {
          const follower = await User.findById(args.followerId);
          const following = await User.findById(args.followingId);

          await User.findByIdAndUpdate(args.followingId, {
            $push: { followers: args.followerId },
          });

          return await User.findByIdAndUpdate(args.followerId, {
            $push: { following: args.followingId },
          });
        } catch (e) {
          throw new Error('Follower or following not found');
        }
      },
    },
  },
});

module.exports = new GraphQLSchema({
  query: RootQuery,
  mutation: Mutation,
});
