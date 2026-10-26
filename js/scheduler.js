// Session-aware selection: respects review due dates and keeps recent cards apart.
// Stable card IDs and the grade() history schema are unchanged.
export function nextCard(cards, history, stars, options, recent = [], now = Date.now(), random = Math.random, counts = {}) {
  const pool = cards.filter(card =>
    (options.topic === 'all' || card.topic === options.topic) &&
    (!options.starredOnly || Boolean(stars[card.id])) &&
    (options.sentencesEnabled !== false || card.type !== 'sentence')
  );
  if (!pool.length) return {card: null, recent, counts};

  // Previously seen cards are ineligible until due, including missed cards.
  const eligible = pool.filter(card => !history[card.id] ||
    Number(history[card.id].due || 0) <= now);
  if (!eligible.length) return {card: null, recent, counts};

  // Guarantee separation of 15 intervening cards when sufficiently many are available.
  // Fallback uses the least recently shown eligible cards for small selections.
  const separated = eligible.filter(card => !recent.includes(card.id));
  const candidates = separated.length ? separated : (() => {
    const positions = eligible.map(c => recent.lastIndexOf(c.id));
    const oldest = Math.min(...positions);
    return eligible.filter((_, i) => positions[i] === oldest);
  })();

  const bucket = card => {
    const h = history[card.id];
    if (!h) return 'new';
    return h.last === 'miss' ? 'reinforcement' : 'due';
  };
  const groups = {new: [], due: [], reinforcement: []};
  for (const card of candidates) groups[bucket(card)].push(card);
  const proportions = options.mix === 'review'
    ? {new: 0.20, due: 0.55, reinforcement: 0.25}
    : options.mix === 'balanced'
      ? {new: 0.45, due: 0.35, reinforcement: 0.20}
      : {new: 0.60, due: 0.25, reinforcement: 0.15};

  // Deficit scheduling approaches the requested proportions over a session.
  // Unavailable categories are skipped (e.g. no due reviews yet).
  const total = Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const available = Object.keys(groups).filter(k => groups[k].length);
  const priorities = available.map(k => ({
    key: k, deficit: (total + 1) * proportions[k] - (counts[k] || 0)
  }));
  const maxDeficit = Math.max(...priorities.map(x => x.deficit));
  const best = priorities.filter(x => Math.abs(x.deficit - maxDeficit) < 1e-9);
  const category = best[Math.floor(random() * best.length)].key;
  const categoryCards = groups[category];

  // Favor underrepresented topics / chapters and difficulties in the recent window.
  const recentCards = recent.map(id => pool.find(c => c.id === id)).filter(Boolean);
  const chapter = card => card.topic?.startsWith('HSK 1 · Chapter ')
    ? card.topic : (card.sourcePack || card.topic || 'other');
  const weight = card => {
    const sameTopic = recentCards.filter(c => chapter(c) === chapter(card)).length;
    const sameDifficulty = card.difficulty
      ? recentCards.filter(c => c.difficulty === card.difficulty).length : 0;
    const daysLate = history[card.id] ? Math.max(0, (now - history[card.id].due) / 86400000) : 0;
    return (1 + Math.min(1, daysLate / 14)) / (1 + sameTopic * 2 + sameDifficulty * 0.5);
  };
  const weights = categoryCards.map(weight);
  let draw = random() * weights.reduce((sum, w) => sum + w, 0);
  let chosen = categoryCards[categoryCards.length - 1];
  for (let i = 0; i < categoryCards.length; i++) {
    draw -= weights[i];
    if (draw <= 0) {chosen = categoryCards[i]; break;}
  }
  return {
    card: chosen,
    recent: [...recent, chosen.id].slice(-15),
    counts: {...counts, [category]: (counts[category] || 0) + 1}
  };
}

export function grade(previous, correct, now = Date.now()) {
  const h = previous || {streak: 0, seen: 0, lapses: 0};
  const streak = correct ? (h.streak || 0) + 1 : 0;
  const lapses = (h.lapses || 0) + (correct ? 0 : 1);
  const minutes = correct
    ? [25, 240, 1440, 4320, 10080, 20160, 43200][Math.min(streak - 1, 6)]
    : Math.min(8, 2 + lapses);
  return {streak, lapses, seen: (h.seen || 0) + 1,
    last: correct ? 'good' : 'miss', due: now + minutes * 60000};
}
