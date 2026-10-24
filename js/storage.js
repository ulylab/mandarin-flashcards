// Storage is per-browser and per-site origin. No review data is sent to GitHub.
export const KEYS = Object.freeze({
  history: 'mandarim-learning-minimal-v2',
  stars: 'mandarim-stars-v1',
  settings: 'mandarim-settings-v2',
  reviews: 'mandarim-review-events-v1'
});
const parse = (key, fallback) => {
  try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); }
  catch { return fallback; }
};
const object = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
const array = x => Array.isArray(x) ? x : [];
export const state = {
  history: object(parse(KEYS.history, {})),
  stars: object(parse(KEYS.stars, {})),
  settings: object(parse(KEYS.settings, {})),
  reviews: array(parse(KEYS.reviews, [])),
  error: ''
};
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); state.error = ''; return true; }
  catch { state.error = 'This browser could not save progress. Check available storage or private browsing.'; return false; }
}
export function saveHistory() { return write(KEYS.history, state.history); }
export function saveStars() { return write(KEYS.stars, state.stars); }
export function saveSettings() { return write(KEYS.settings, state.settings); }
export function saveReview(cardId, correct, dueAt) {
  const entry = { id: String(cardId), correct: Boolean(correct), at: Date.now(), due: dueAt };
  state.reviews.push(entry);
  // Store the full review log for export and detailed personal history.
  return write(KEYS.reviews, state.reviews);
}
export function exportProgress() {
  return {
    format: 'mandarin-flashcards-progress', version: 1,
    exportedAt: new Date().toISOString(),
    history: state.history, stars: state.stars,
    settings: state.settings, reviews: state.reviews
  };
}
export function importProgress(data) {
  if (!data || data.format !== 'mandarin-flashcards-progress' || data.version !== 1 ||
      !data.history || !data.stars || !Array.isArray(data.reviews)) {
    throw new Error('This is not a recognized Mandarin Flashcards backup.');
  }
  if (data.reviews.length > 150000) throw new Error('Backup contains too many review records.');
  const safeHistory = object(data.history), safeStars = object(data.stars), safeSettings = object(data.settings);
  for (const [id, rec] of Object.entries(safeHistory)) {
    if (!rec || typeof rec !== 'object' || !Number.isFinite(Number(rec.seen || 0)) || id.length > 128)
      throw new Error('Invalid card history in backup.');
  }
  state.history = safeHistory;
  state.stars = safeStars;
  state.settings = safeSettings;
  state.reviews = data.reviews.filter(e => e && typeof e.id === 'string' && typeof e.correct === 'boolean' && Number.isFinite(e.at));
  const ok = [saveHistory(), saveStars(), saveSettings(), write(KEYS.reviews, state.reviews)].every(Boolean);
  if (!ok) throw new Error(state.error);
}
export function resetReviewHistory() {
  state.history = {};
  state.reviews = [];
  return saveHistory() && write(KEYS.reviews, state.reviews);
}
