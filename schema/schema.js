require('dotenv').config();
const { generateAccessToken, authenticateToken } = require('../auth/auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Card = require('../models/card');
const Deck = require('../models/deck');
const User = require('../models/user');
const Category = require('../models/category');
const { getNextReview } = require('../utils/study');

const {
  GraphQLObjectType,
  GraphQLString,
  GraphQLSchema,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
} = require('graphql');

const UserType = new GraphQLObjectType({
  name: 'User',
  fields: () => ({
    id: { type: GraphQLID },
    email: { type: GraphQLString },
    name: { type: GraphQLString },
    img: { type: GraphQLString },
    experience: { type: GraphQLInt },
    followers: {
      type: new GraphQLList(UserType),
      async resolve(parent, args) {
        const user = await User.findById(parent.id);
        return await User.find({
          _id: { $in: user.followers },
        });
      },
    },
    following: {
      type: new GraphQLList(UserType),
      async resolve(parent, args) {
        const user = await User.findById(parent.id);
        return await User.find({
          _id: { $in: user.following },
        });
      },
    },
    decks: {
      type: new GraphQLList(DeckType),
      resolve(parent, args, context) {
        const { token } = context;
        const user = authenticateToken(token);

        if (user) return Deck.find({ userId: parent.id });

        return Deck.find({ userId: parent.id, publicId: { $ne: null } });
      },
    },
    mastered: {
      type: GraphQLInt,
      async resolve(parent, args, context) {
        const decks = await Deck.find({ userId: parent.id });

        let count = 0;

        for (const deck of decks) {
          const masteredCards = await Card.find({
            deckId: deck.id,
            mastered: true,
          });
          count += masteredCards ? masteredCards.length : 0;
        }

        return count;
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
    learners: {
      type: GraphQLInt,
      async resolve(parent, args) {
        if (parent.publicId) {
          const learners = await Deck.find({ publicId: parent.publicId });
          return learners.length;
        }
        return 1;
      },
    },
    publicId: { type: GraphQLString },
    category: {
      type: CategoryType,
      resolve(parent, args) {
        return Category.findById(parent.categoryId);
      },
    },
    createdBy: {
      type: UserType,
      resolve(parent, args) {
        return User.findById(parent.createdBy);
      },
    },
    user: {
      type: UserType,
      resolve(parent, args) {
        return User.findById(parent.userId);
      },
    },
    mastered: {
      type: GraphQLInt,
      async resolve(parent, args) {
        const mastered = await Card.find({ deckId: parent.id, mastered: true });

        return mastered.length;
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
    publicId: { type: GraphQLID },
    front: { type: GraphQLString },
    back: { type: GraphQLString },
    step: { type: GraphQLInt },
    streak: { type: GraphQLInt },
    img: { type: GraphQLString },
    audio: { type: GraphQLString },
    nextReview: { type: GraphQLString },
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

        if (deck.publicId && !user) return deck;

        if (!deck.publicId && deck.userId !== user?.id)
          throw new Error('Forbidden');

        const copy = await Deck.findOne({ publicId: deck.id, userId: user.id });

        return copy ? copy : deck;
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
      async resolve(parent, args) {
        const decks = await Deck.find({ publicId: { $ne: null } });
        return decks.filter((deck) => deck.id === deck.publicId);
      },
    },
  },
});

const Mutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    createUser: {
      type: SessionType,
      args: {
        email: { type: new GraphQLNonNull(GraphQLString) },
        name: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
        confirmPassword: { type: new GraphQLNonNull(GraphQLString) },
      },
      async resolve(parent, args, context) {
        const { name, email, password, confirmPassword } = args;

        if (!email) throw new Error('Email is required');
        if (!name) throw new Error('Name is required');
        if (!password) throw new Error('Password is required');

        if (password !== confirmPassword)
          throw new Error('Passwords do not match');

        if (name.length > 20) {
          throw new Error('The name is too long. Max 20 characters allowed');
        }

        const alreadyExists = await User.findOne({ email: email });

        if (alreadyExists) throw new Error('This email is already taken');

        try {
          const hashedPassword = await bcrypt.hash(password, 10);

          const user = {
            email: email,
            name: name,
            password: hashedPassword,
          };
          const userDB = await User(user).save();

          const authenticatedUser = { id: userDB.id, email: user.email };
          const accessToken = generateAccessToken(authenticatedUser);
          const refreshToken = jwt.sign(
            authenticatedUser,
            process.env.REFRESH_TOKEN_SECRET
          );
          const expires = new Date(Date.now() + 900000).toString();

          context.res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            sameSite: 'none',
            secure: true,
          });

          return { user: userDB, accessToken, expires };
        } catch (e) {
          throw new Error(e.message);
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
      type: GraphQLString,
      args: {
        userId: { type: new GraphQLNonNull(GraphQLID) },
      },
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);
        const { userId } = args;

        if (!user) throw new Error('Forbidden');

        const userDB = await User.findById(user.id);

        if (userDB.following.includes(userId)) {
          try {
            await User.findByIdAndUpdate(user.id, {
              $pull: { following: userId },
            });

            await User.findByIdAndUpdate(userId, {
              $pull: { followers: user.id },
            });

            return 'Unfollowed';
          } catch (e) {
            throw new Error('Follower or following not found');
          }
        } else {
          try {
            await User.findByIdAndUpdate(userId, {
              $push: { followers: user.id },
            });

            await User.findByIdAndUpdate(user.id, {
              $push: { following: userId },
            });

            return 'Followed';
          } catch (e) {
            throw new Error('Follower or following not found');
          }
        }
      },
    },
    createDeck: {
      type: DeckType,
      args: {
        title: { type: GraphQLString },
        img: { type: GraphQLString },
        categoryId: { type: GraphQLID },
      },
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);

        if (!user) throw new Error('Forbidden');

        if (!args.title) throw new Error('Title is required');
        if (!args.categoryId) throw new Error('You must select a category');

        try {
          const { title, img, categoryId } = args;

          const deck = {
            title,
            img: img ? img : 'https://via.placeholder.com/100x70',
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
        return 'Logged out';
      },
    },
    quitDeck: {
      type: DeckType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);

        if (!user) throw new Error('Forbidden');

        const deck = await Deck.findById(args.id);

        if (deck.publicId === deck.id) {
          await Deck.updateMany(
            { publicId: deck.id },
            {
              $set: { publicId: null },
            }
          );
        }

        return await Deck.deleteOne({ _id: args.id, userId: user.id });
      },
    },
    copyDeck: {
      type: DeckType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);

        if (!user) throw new Error('Forbidden');

        const deck = await Deck.findById(args.id);

        const alreadyExist = await Deck.findOne({
          publicId: args.id,
          userId: user.id,
        });

        if (alreadyExist) return alreadyExist;

        const deckCopy = {
          title: deck.title,
          img: deck.img,
          userId: user.id,
          createdBy: deck.createdBy,
          categoryId: deck.categoryId,
          publicId: deck.id,
        };

        const deckCopyDB = await Deck(deckCopy).save();

        const cards = await Card.find({ deckId: deck.id });

        for (const card of cards) {
          const cardCopy = {
            publicId: card.id,
            front: card.front,
            back: card.back,
            img: card.img,
            audio: card.audio,
            deckId: deckCopyDB.id,
          };
          Card(cardCopy).save();
        }

        return deckCopyDB;
      },
    },
    createCard: {
      type: CardType,
      args: {
        deckId: { type: new GraphQLNonNull(GraphQLID) },
        front: { type: new GraphQLNonNull(GraphQLString) },
        back: { type: new GraphQLNonNull(GraphQLString) },
        img: { type: GraphQLString },
        audio: { type: GraphQLString },
      },
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);
        if (!user) throw new Error('Forbidden');

        const { deckId, front, back } = args;

        if (front.length > 255 || back.length > 255)
          throw new Error('Fields are too long, max 255 characters allowed.');

        const deck = await Deck.findById(deckId);
        if (!deck) throw new Error('Deck not found');

        if (deck.publicId && deck.publicId !== deck.id)
          throw new Error('Not authorized to modify deck');

        const card = {
          publicId: null,
          front,
          back,
          img: args?.img,
          audio: args?.audio,
          deckId,
        };

        const originalCard = await Card(card).save();

        if (deck.publicId === deck.id) {
          const decksToUpdate = await Deck.find({
            publicId: deck.publicId,
            _id: { $ne: deck.id },
          });

          card.publicId = originalCard.id;

          await Card.updateOne(
            { _id: originalCard.id },
            { $set: { publicId: originalCard.id } }
          );

          for (const deck of decksToUpdate) {
            card.deckId = deck.id;

            await Card(card).save();
          }
        }

        return null;
      },
    },
    deleteCard: {
      type: GraphQLString,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);
        if (!user) throw new Error('Forbidden');

        const card = await Card.findById(args.id);
        if (!card) throw new Error('Card not found');

        const deck = await Deck.findOne({ _id: card.deckId, userId: user.id });
        if (!deck) throw new Error('Deck not found');

        if (deck.publicId !== deck.id)
          throw new Error('Not authorized to modify deck');

        await Card.deleteMany({ publicId: card.id });

        return 'successfully deleted';
      },
    },
    editDeck: {
      type: DeckType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        title: { type: new GraphQLNonNull(GraphQLString) },
        categoryId: { type: new GraphQLNonNull(GraphQLID) },
      },
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);
        if (!user) throw new Error('Forbidden');

        const { id, title, categoryId } = args;

        const deck = await Deck.findOne({ _id: id, userId: user.id });
        if (!deck) throw new Error('Deck not found');

        const category = await Category.findById(categoryId);
        if (!category) throw new Error('Category not found');

        if (deck.id === deck.publicId) {
          await Deck.updateMany(
            { publicId: deck.publicId },
            { $set: { title, categoryId } }
          );
        } else if (!deck.publicId) {
          await Deck.updateOne({ _id: id }, { $set: { title, categoryId } });
        } else {
          throw new Error('Not authorized to modify deck');
        }
      },
    },
    changeVisibility: {
      type: GraphQLString,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);
        if (!user) throw new Error('Forbidden');

        const { id } = args;

        const deck = await Deck.findOne({ _id: id, userId: user.id });

        if (deck.id === deck.publicId) {
          await Card.updateMany(
            { deckId: deck.publicId },
            { $set: { publicId: null } }
          );

          const decksToUpdate = await Deck.find({ publicId: deck.publicId });

          for (const deck of decksToUpdate) {
            await Card.updateMany(
              { deckId: deck.id },
              { $set: { publicId: null } }
            );
          }

          await Deck.updateMany(
            { publicId: deck.publicId },
            { $set: { publicId: null } }
          );
        } else if (!deck.publicId) {
          await Deck.updateOne({ _id: id }, { $set: { publicId: id } });

          const cardsToUpdate = await Card.find({ deckId: deck.id });

          for (const card of cardsToUpdate) {
            await Card.updateOne(
              { _id: card.id },
              { $set: { publicId: card.id } }
            );
          }
        } else {
          throw new Error('Not authorized to modify deck');
        }
      },
    },
    optOut: {
      type: GraphQLString,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);
        if (!user) throw new Error('Forbidden');

        const { id } = args;

        const deck = await Deck.findOne({ _id: id, userId: user.id });

        if (!deck) throw new Error('Deck not found');

        if (deck.publicId !== deck.id) {
          await Deck.findByIdAndUpdate(id, { $set: { publicId: null } });
          await Card.updateMany(
            { deckId: id },
            {
              $set: {
                publicId: null,
              },
            }
          );
          return 'Successfully opted out of synching';
        }
      },
    },
    accessToken: {
      type: SessionType,
      resolve(parent, args, context) {
        const refreshToken = context.req.cookies.refreshToken;
        const user = authenticateToken(
          refreshToken,
          process.env.REFRESH_TOKEN_SECRET
        );

        if (!user) throw new Error('Forbidden');

        const { id, email } = user;
        const accessToken = generateAccessToken({ id, email });

        // const expires = new Date(Date.now() + 15000).toString(); // for testing only
        const expires = new Date(Date.now() + 900000).toString();

        return { accessToken, expires };
      },
    },
    editCard: {
      type: CardType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        front: { type: new GraphQLNonNull(GraphQLString) },
        back: { type: new GraphQLNonNull(GraphQLString) },
      },
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);
        if (!user) throw new Error('Forbidden');

        const { id, front, back } = args;

        if (front.length > 255 || back.length > 255)
          throw new Error('Fields are too long, max 255 characters allowed.');

        const card = await Card.findByIdAndUpdate(id, {
          $set: { front, back },
        });
        if (!card) throw new Error('Card not found');

        const deck = await Deck.findOne({ _id: card.deckId, userId: user.id });
        if (deck.publicId && deck.publicId !== deck.id)
          throw new Error('Not authorized to modify deck');

        await Card.updateMany({ publicId: card.id }, { $set: { front, back } });
      },
    },
    studySession: {
      type: GraphQLInt,
      args: {
        cards: { type: GraphQLString },
      },
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);
        if (!user) throw new Error('Forbidden');

        const cards = JSON.parse(args.cards);

        let experienceGained = 0;

        for (const card of cards) {
          const cardDB = await Card.findById(card.id);
          const deck = await Deck.findOne({
            _id: cardDB.deckId,
            userId: user.id,
          });

          if (!deck) throw new Error('Not authorized to modify this deck');

          if (cardDB) {
            const { nextReview, streak, step, mastered } = getNextReview(
              cardDB,
              card.rated
            );

            experienceGained += mastered ? streak * 10 : streak * 5;

            await Card.updateOne(
              { _id: cardDB.id },
              {
                $set: {
                  nextReview: new Date(nextReview),
                  streak,
                  step,
                  mastered,
                },
              }
            );
          }
        }

        await User.updateOne(
          { _id: user.id },
          { $inc: { experience: experienceGained } }
        );

        return experienceGained;
      },
    },
    resetDeck: {
      type: DeckType,
      args: {
        id: { type: GraphQLID },
      },
      async resolve(parent, args, context) {
        const token = context.token;
        const user = authenticateToken(token);
        if (!user) throw new Error('Forbidden');

        const deck = await Deck.findOne({ _id: args.id, userId: user.id });

        if (!deck) throw new Error('Deck not found');

        await Card.updateMany(
          { deckId: deck.id },
          {
            $set: {
              step: 2,
              streak: 0,
              mastered: false,
              nextReview: null,
            },
          }
        );

        return deck;
      },
    },
  },
});

module.exports = new GraphQLSchema({
  query: RootQuery,
  mutation: Mutation,
});
