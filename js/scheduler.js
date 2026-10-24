export function nextCard(cards, history, stars, options, recent, now = Date.now(), random = Math.random) {
  const pool = cards.filter(card =>
    (options.topic === 'all' || card.topic === options.topic) &&
    (!options.starredOnly || Boolean(stars[card.id])) &&
    (options.sentencesEnabled !== false || card.type !== 'sentence')
  );
  if (!pool.length) return {card: null, recent};
  const mix = options.mix || 'balanced';
  const weighted = pool.map(card => {
    const h = history[card.id];
    let weight;
    if (!h) {
      weight = mix === 'new' ? 6 : mix === 'review' ? 1.4 : 3.5;
    } else {
      const overdue = (now - (h.due || 0)) / 60000;
      const seen = h.seen || 0;
      const missed = h.last === 'miss';
      if (overdue >= 0) weight = missed ? 11 + Math.min(8, overdue / 2) : 3 + Math.min(3, overdue / 240);
      else weight = missed ? Math.max(0.2, 2.5 + overdue / 8) : 0.08;
      if (mix === 'review') weight *= 2;
      if (mix === 'new') weight *= 0.6;
      weight /= 1 + Math.max(0, seen - 1) * 0.07;
    }
    if (recent.includes(card.id)) weight *= 0.025;
    return { card, weight: Math.max(0.001, weight) };
  });
  let threshold = random() * weighted.reduce((sum, x) => sum + x.weight, 0);
  let chosen = weighted[weighted.length - 1].card;
  for (const entry of weighted) {
    threshold -= entry.weight;
    if (threshold <= 0) { chosen = entry.card; break; }
  }
  const nextRecent = [...recent, chosen.id].slice(-Math.min(6, Math.max(1, pool.length - 1)));
  return { card: chosen, recent: nextRecent };
}
export function grade(previous, correct, now = Date.now()) {
  const h = previous || {streak: 0, seen: 0, lapses: 0};
  const streak = correct ? (h.streak || 0) + 1 : 0;
  const lapses = (h.lapses || 0) + (correct ? 0 : 1);
  const minutes = correct
    ? [25, 240, 1440, 4320, 10080, 20160, 43200][Math.min(streak - 1, 6)]
    : Math.min(8, 2 + lapses);
  return { streak, lapses, seen: (h.seen || 0) + 1,
    last: correct ? 'good' : 'miss', due: now + minutes * 60000 };
}
