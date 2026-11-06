// Pure Chapter Review helpers. No flashcard scheduler or progress keys are changed.
export const REVIEW_SCREENS = Object.freeze(['Vocabulary', 'Concepts', 'Examples', 'Exercises', 'Challenge']);

export function normalizePinyin(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function checkReviewAnswer(question, answer) {
  if (!question || !['choice', 'order', 'input'].includes(question.kind)) return false;
  if (question.kind === 'choice') return Number.isInteger(answer) && answer === question.answer;
  if (question.kind === 'order') return Array.isArray(answer) &&
    answer.length === question.answer.length && answer.every((token, i) => token === question.answer[i]);
  return typeof answer === 'string' &&
    question.answers.some(expected => normalizePinyin(answer) === normalizePinyin(expected));
}

export function validateReviewLesson(lesson) {
  if (!lesson || !Number.isInteger(lesson.number) || lesson.number < 1 || lesson.number > 15 ||
      lesson.id !== 'chapter-' + String(lesson.number).padStart(2, '0') ||
      !Array.isArray(lesson.supportingWords) || !Array.isArray(lesson.concepts) ||
      !Array.isArray(lesson.stories) || !Array.isArray(lesson.practice) ||
      !Array.isArray(lesson.challenge)) throw new Error('Invalid Chapter 11 lesson.');
  if (!lesson.supportingWords.length || lesson.concepts.length < 3 ||
      lesson.stories.length < 2 || lesson.practice.length < 6 ||
      lesson.challenge.length < 8) throw new Error('Chapter 11 lesson is incomplete.');
  const ids = new Set();
  for (const question of [...lesson.practice, ...lesson.challenge]) {
    if (!question.id || ids.has(question.id) || !question.question || !question.why)
      throw new Error('Duplicate or malformed Chapter 11 question.');
    ids.add(question.id);
    if (question.kind === 'choice') {
      if (!Array.isArray(question.options) || question.options.length < 2 ||
          !Number.isInteger(question.answer) || question.answer < 0 ||
          question.answer >= question.options.length) throw new Error('Invalid choice question.');
    } else if (question.kind === 'order') {
      if (!Array.isArray(question.tokens) || !Array.isArray(question.answer) ||
          question.answer.length !== question.tokens.length ||
          [...question.tokens].sort().join('|') !== [...question.answer].sort().join('|'))
        throw new Error('Invalid ordering question.');
    } else if (question.kind === 'input') {
      if (!Array.isArray(question.answers) || !question.answers.length) throw new Error('Invalid input question.');
    } else throw new Error('Unsupported question type.');
  }
  for (const story of lesson.stories) {
    if (!Array.isArray(story.lines) || !story.lines.length ||
        story.lines.some(line => !Array.isArray(line) || line.length !== 3 || line.some(part => !part)))
      throw new Error('Invalid example story.');
  }
  return true;
}

export function chapterState(progress, id = 'chapter-11') {
  const chapter = progress && typeof progress === 'object' ? progress[id] : null;
  return {
    visited: Array.isArray(chapter?.visited)
      ? [...new Set(chapter.visited.filter(n => Number.isInteger(n) && n >= 0 && n < REVIEW_SCREENS.length))]
      : [],
    practice: chapter?.practice && typeof chapter.practice === 'object' && !Array.isArray(chapter.practice)
      ? chapter.practice : {},
    bestScore: Math.max(0, Number(chapter?.bestScore) || 0),
    latestScore: Math.max(0, Number(chapter?.latestScore) || 0),
    attempts: Math.max(0, Number(chapter?.attempts) || 0),
    lastCompletedAt: Number(chapter?.lastCompletedAt) || null
  };
}

export function recordVisited(chapter, screen) {
  return {...chapter, visited: [...new Set([...chapter.visited, screen])].sort((a,b) => a-b)};
}

export function recordPractice(chapter, id, correct) {
  const old = chapter.practice[id] || {attempts: 0};
  return {...chapter, practice: {...chapter.practice, [id]: {
    attempts: (Number(old.attempts) || 0) + 1, correct: Boolean(correct)
  }}};
}

export function recordChallenge(chapter, correct, total, now = Date.now()) {
  const score = Math.round(100 * correct / total);
  return {...chapter, latestScore: score, bestScore: Math.max(chapter.bestScore, score),
    attempts: chapter.attempts + 1, lastCompletedAt: now};
}
