const DIFFICULTY = {
  EASY: 0,
  NORMAL: 1,
  HARD: 2,
  DIDNT_KNOW: 3,
};

const getNextReview = (card, answered) => {
  const HOUR_IN_MS = 60 * 60 * 1000;

  if (card.nextReview) {
    const { nextReview, step, streak } = card;
    let newStep = step;

    if (answered === DIFFICULTY.EASY) {
      newStep = step + 0.5;
    } else if (answered === DIFFICULTY.NORMAL) {
      newStep = step + 0.3;
    } else if (answered === DIFFICULTY.HARD) {
      newStep = step + 0.1;
    } else if (answered === DIFFICULTY.DIDNT_KNOW) {
      if (step - 0.2 >= 0.1) return nextReview + (step - 0.2) * 3 * HOUR_IN_MS;
      else return nextReview + 0.1 * 3 * HOUR_IN_MS;
    }
    return nextReview + newStep * 3 * 2 ** streak * HOUR_IN_MS;
  } else {
    if (answered === DIFFICULTY.EASY) {
      return Date.now() + 12 * HOUR_IN_MS;
    } else if (answered === DIFFICULTY.NORMAL) {
      return Date.now() + 6 * HOUR_IN_MS;
    } else {
      return Date.now() + 3 * HOUR_IN_MS;
    }
  }
};

module.exports = {
  DIFFICULTY,
  getNextReview,
};
