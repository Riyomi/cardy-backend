require('dotenv').config();
const { generateAccessToken, authenticateToken } = require('../auth/auth');

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
  GraphQLBoolean,
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
      resolve(parent, args, context) {
        const { token } = context;
        const user = authenticateToken(token);

        if (user) return Deck.find({ userId: parent.id });

        return Deck.find({ userId: parent.id, isPublic: true });
      },
    },
  }),
});

const SessionType = new GraphQLObjectType({
  name: 'Session',
  fields: () => ({
    user: { type: UserType },
    accessToken: { type: GraphQLString },
    expires: { type: GraphQLString },
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
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);

        const deck = await Deck.findById(args.id);

        if (!deck.isPublic && deck.userId !== user?.id)
          throw new Error('Forbidden');
        return deck;
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
    decks: {
      type: GraphQLList(DeckType),
      resolve(parent, args) {
        return Deck.find({ isPublic: true });
      },
    },
    accessToken: {
      type: GraphQLString,
      resolve(parent, args, context) {
        const refreshToken = context.req.cookies.refreshToken;
        const user = authenticateToken(
          refreshToken,
          process.env.REFRESH_TOKEN_SECRET
        );

        if (!user) throw new Error('Forbidden');

        const accessToken = generateAccessToken(user);

        return accessToken;
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
      type: SessionType,
      args: {
        email: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
      },
      async resolve(parent, args, context) {
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
              const expires = new Date(Date.now() + 900000).toString();
              // const expires = new Date(Date.now() + 15000).toString(); // for testing only

              context.res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                sameSite: 'none',
                secure: true,
              });

              return { user, accessToken, expires };
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
        userToBeFollowed: { type: new GraphQLNonNull(GraphQLID) },
      },
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);

        if (!user) throw new Error('Forbidden');

        try {
          await User.findByIdAndUpdate(args.userToBeFollowed, {
            $push: { followers: user.id },
          });

          return await User.findByIdAndUpdate(user.id, {
            $push: { following: args.userToBeFollowed },
          });
        } catch (e) {
          throw new Error('Follower or following not found');
        }
      },
    },
    unfollowUser: {
      type: UserType,
      args: {
        userToBeUnfollowed: { type: new GraphQLNonNull(GraphQLID) },
      },
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);

        if (!user) throw new Error('Forbidden');

        try {
          await User.findByIdAndUpdate(user.id, {
            $pull: { following: args.userToBeUnfollowed },
          });

          return await User.findByIdAndUpdate(args.userToBeUnfollowed, {
            $pull: { followers: user.id },
          });
        } catch (e) {
          throw new Error('Follower or following not found');
        }
      },
    },
    createDeck: {
      type: DeckType,
      args: {
        title: { type: new GraphQLNonNull(GraphQLString) },
        img: { type: GraphQLString },
        isPublic: { type: new GraphQLNonNull(GraphQLBoolean) },
        categoryId: { type: new GraphQLNonNull(GraphQLID) },
      },
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);

        if (!user) throw new Error('Forbidden');

        try {
          const { title, img, isPublic, categoryId } = args;

          const deck = {
            title,
            img: img ? img : 'https://via.placeholder.com/100x70',
            isPublic,
            categoryId,
            userId: user.id,
            createdBy: user.id,
          };

          return await Deck(deck).save();
        } catch (e) {
          throw new Error('Failed to save deck');
        }
      },
    },
    logoutUser: {
      type: GraphQLString,
      async resolve(parent, args, context) {
        context.res.clearCookie('refreshToken');
        context.res.clearCookie('accessToken');

        return 'Logged out';
      },
    },
  },
});

module.exports = new GraphQLSchema({
  query: RootQuery,
  mutation: Mutation,
});
