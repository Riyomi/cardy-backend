const DIFFICULTY = {
  EASY: 0,
  NORMAL: 1,
  HARD: 2,
  DIDNT_KNOW: 3,
};

const getNextReview = (card, answered) => {
  const HOUR_IN_MS = 60 * 60 * 1000;
  const now = Date.now();
  const { step, streak, mastered } = card;

  switch (answered) {
    case DIFFICULTY.EASY:
      return {
        mastered: step + 0.5 >= 5 || mastered ? true : false,
        nextReview: now + Math.floor(6 * HOUR_IN_MS * step * 2 ** streak),
        step: step + 0.5,
        streak: streak + 1,
      };
    case DIFFICULTY.NORMAL:
      return {
        mastered: step + 0.3 >= 5 || mastered ? true : false,
        nextReview: now + Math.floor(3 * HOUR_IN_MS * step * 2 ** streak),
        step: step + 0.3,
        streak: streak + 1,
      };
    case DIFFICULTY.HARD:
      return {
        mastered: step + 0.1 >= 5 || mastered ? true : false,
        nextReview: now + Math.floor(1.5 * HOUR_IN_MS * step * 2 ** streak),
        step: step + 0.1,
        streak: streak + 1,
      };
    case DIFFICULTY.DIDNT_KNOW:
      return {
        mastered: mastered,
        nextReview: now + Math.floor(0.5 * HOUR_IN_MS * step),
        step: step - 0.2 >= 0 ? step - 0.2 : 0,
        streak: 0,
      };
  }
};

module.exports = {
  DIFFICULTY,
  getNextReview,
};
