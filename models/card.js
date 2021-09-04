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
    required: true,
  },
  streak: {
    type: Number,
    required: true,
  },
  deckId: {
    type: String,
    required: true,
  },
  mastered: {
    type: Boolean,
    default: false,
  },
  img: String,
  audio: String,
});

module.exports = mongoose.model('Card', cardSchema);
