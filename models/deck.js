const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const deckSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  img: {
    type: String,
    default: 'https://via.placeholder.com/100x70',
  },
  userId: {
    type: String,
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  categoryId: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    default: null,
  },
});

module.exports = mongoose.model('Deck', deckSchema);
