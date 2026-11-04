// A question bank is the existing card topic. Keep older single-topic preferences
// and backups compatible while supporting multiple selected topics.
export function resolveBanks(settings = {}, available = []) {
  if (Array.isArray(settings.topics)) {
    const selected = new Set(settings.topics);
    return available.filter(bank => selected.has(bank));
  }
  if (settings.topics === 'all') return [...available];
  if (settings.topic && settings.topic !== 'all' && available.includes(settings.topic))
    return [settings.topic];
  return [...available];
}

export function matchesBank(card, options = {}) {
  if (options.topics === 'all') return true;
  if (Array.isArray(options.topics)) return options.topics.includes(card.topic);
  return !options.topic || options.topic === 'all' || card.topic === options.topic;
}
