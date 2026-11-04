// Sort chapter banks numerically (1, 2, ... 15), then other banks alphabetically.
export function compareBanks(a, b) {
  const chapterPattern = /^HSK 1 · Chapter (\d+)$/;
  const aChapter = chapterPattern.exec(a);
  const bChapter = chapterPattern.exec(b);
  if (aChapter && bChapter) return Number(aChapter[1]) - Number(bChapter[1]);
  if (aChapter) return -1;
  if (bChapter) return 1;
  return a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'});
}

// The book's 169 vocabulary IDs retain their original bank and review history.
// Each lesson also appears in its chapter bank without duplicating the card.
export function bankMemberships(card) {
  const banks = [card.topic];
  if (card.topic === 'HSK Book 1 vocabulary' && Number.isInteger(card.lesson) && card.lesson >= 1 && card.lesson <= 15)
    banks.push(`HSK 1 · Chapter ${card.lesson}`);
  return banks;
}

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
  const banks = bankMemberships(card);
  if (Array.isArray(options.topics)) return options.topics.some(bank => banks.includes(bank));
  return !options.topic || options.topic === 'all' || banks.includes(options.topic);
}
