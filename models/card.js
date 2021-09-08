const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cardSchema = new Schema({
  front: {
    type: String,
    required: true,
  },
  back: {
    type: String,
    required: true,
  },
  step: {
    type: Number,
    default: 2,
  },
  streak: {
    type: Number,
    default: 0,
  },
  deckId: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    default: null,
  },
  mastered: {
    type: Boolean,
    default: false,
  },
  img: {
    type: String,
    default: null,
  },
  audio: {
    type: String,
    default: null,
  },
});

module.exports = mongoose.model('Card', cardSchema);
