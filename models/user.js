const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: String,
  level: Number,
  experience: Number,
  followers: Array,
  following: Array,
  decks: Array,
});

module.exports = mongoose.model('User', userSchema);
