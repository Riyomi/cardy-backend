const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const deckSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  img: {
    type: String,
    default: 'https://via.placeholder.com/100x70',
  },
  categoryId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  isPublic: {
    type: Boolean,
    required: true,
    default: false,
  },
  learners: {
    type: Array,
    default: [],
  },
  cards: {
    type: Array,
    default: [],
  },
});

module.exports = mongoose.model('Deck', deckSchema);
