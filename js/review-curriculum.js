// Assemble interactive HSK 1 lessons from authored grammar and the existing sentence/card banks.
// The underlying flashcard card IDs, answers and review scheduler stay unchanged.
export const REVIEW_CHAPTERS = Object.freeze(Array.from({length: 15}, (_, i) => ({
  number: i + 1, id: 'chapter-' + String(i + 1).padStart(2, '0')
})));

export function buildChapterReviewLesson(definition, sentenceCards, bookWords) {
  const n = definition?.number;
  const id = 'chapter-' + String(n).padStart(2, '0');
  if (!Number.isInteger(n) || n < 1 || n > 15 || n === 11 || definition.id !== id)
    throw new Error('Invalid chapter lesson outline.');
  if (!Array.isArray(sentenceCards) || sentenceCards.length !== 10 ||
      sentenceCards.some(card => card.type !== 'sentence' || card.topic !== 'HSK 1 · Chapter ' + n))
    throw new Error('Missing HSK sentence cards for Chapter ' + n + '.');
  if (!Array.isArray(bookWords) || bookWords.length < 3 ||
      bookWords.some(word => word.topic !== 'HSK Book 1 vocabulary' || word.lesson !== n))
    throw new Error('Missing chapter vocabulary for Chapter ' + n + '.');
  const lines = sentenceCards.map(card => [card.zh, card.py, card.en]);
  const concepts = definition.concepts.map(concept => ({
    heading: concept.heading, rule: concept.rule, formula: concept.formula,
    examples: concept.exampleIndices.map(index => lines[index])
  }));
  const stories = definition.storyGroups.map(group => ({
    title: group.title, lines: group.indices.map(index => lines[index])
  }));

  // Select distractors from the same chapter, never inventing Chinese or pinyin.
  const choice = (idSuffix, question, sourceIndex, language) => {
    const source = lines[sourceIndex];
    const key = language === 'en' ? 2 : 0;
    const answerText = source[key];
    const other = lines.filter((item, i) => i !== sourceIndex && item[key] !== answerText)
      .map(item => item[key]).filter((value, i, items) => items.indexOf(value) === i);
    if (other.length < 2) throw new Error('Not enough distinct answer choices.');
    const offset = sourceIndex % other.length;
    const options = [answerText, other[offset], other[(offset + 1) % other.length]];
    const correctPosition = sourceIndex % 3;
    const ordered = [...options.slice(1)];
    ordered.splice(correctPosition, 0, answerText);
    return {id:idSuffix,kind:'choice',question,options:ordered,answer:correctPosition,
      why:source[0] + ' · ' + source[1] + ' · ' + source[2]};
  };
  const translate = (suffix, index) => choice(suffix, 'What does this mean? ' + lines[index][0], index, 'en');
  const recognize = (suffix, index) =>
    choice(suffix, 'Choose the Chinese for: ' + lines[index][2], index, 'zh');
  const order = (suffix, index) => {
    const card = sentenceCards[index];
    const answer = card.breakdown.map(part => part.zh);
    if (answer.length < 2) return translate(suffix, index);
    const tokens = [...answer.slice(1), answer[0]];
    return {id:suffix,kind:'order',question:'Build the sentence: ' + card.en,
      tokens,answer,why:card.zh + ' · ' + card.py};
  };
  const pinyin = (suffix, wordIndex, typed = false) => {
    const word = bookWords[wordIndex % bookWords.length];
    if (typed) return {id:suffix,kind:'input',question:'Type pinyin for: ' + word.zh,
      answers:[word.py],hint:word.en,why:word.zh + ' is ' + word.py + ' (' + word.en + ').'};
    const alternatives = [...new Map(bookWords.filter(w => w.py !== word.py).map(w => [w.py, w])).values()];
    if (alternatives.length < 2) throw new Error('Not enough pinyin alternatives.');
    const altA = alternatives[(wordIndex + 1) % alternatives.length].py;
    const altB = alternatives[(wordIndex + 2) % alternatives.length].py;
    const options = [word.py,altA,altB];
    const correctPosition = wordIndex % 3;
    options.shift();
    options.splice(correctPosition,0,word.py);
    return {id:suffix,kind:'choice',question:'Which pinyin matches ' + word.zh + '?',
      options,answer:correctPosition,why:word.zh + ' · ' + word.py + ' · ' + word.en};
  };
  const q = (type, key, i) =>
    ({translate:() => translate(key,i),recognize:() => recognize(key,i),
      order:() => order(key,i),pinyin:() => pinyin(key,i),typed:() => pinyin(key,i,true)})[type]();
  const generate = (prefix, specs) => specs.map(([type,index],i)=>q(type,prefix+'-'+String(i+1).padStart(2,'0'),index));
  const practice = generate('p',[
    ['translate',0],['recognize',1],['pinyin',0],['order',2],
    ['translate',4],['typed',1],['recognize',6],['order',7]
  ]);
  const challenge = generate('c',[
    ['translate',1],['pinyin',2],['recognize',3],['order',4],['typed',3],
    ['translate',5],['recognize',8],['order',9],['pinyin',4],['typed',5]
  ]);
  return {id,number:n,title:definition.title,subtitle:definition.subtitle,
    supportingWords:definition.supportingWords,concepts,stories,practice,challenge};
}

export function validateLessonCatalog(catalog) {
  if (catalog?.version !== 1 || !Array.isArray(catalog.chapters) || catalog.chapters.length !== 14)
    throw new Error('Invalid chapter lesson catalog.');
  const numbers = catalog.chapters.map(c => c.number);
  if (new Set(numbers).size !== 14 ||
      numbers.some(n => !Number.isInteger(n) || n < 1 || n > 15 || n === 11))
    throw new Error('Chapter catalog contains missing or duplicate lessons.');
  for (const c of catalog.chapters) {
    if (c.id !== 'chapter-' + String(c.number).padStart(2,'0') ||
        !c.title || !c.subtitle || !Array.isArray(c.supportingWords) ||
        c.supportingWords.length < 3 || !Array.isArray(c.concepts) || c.concepts.length < 3 ||
        !Array.isArray(c.storyGroups) || c.storyGroups.length < 2) throw new Error('Incomplete Chapter ' + c.number);
    for (const pattern of c.concepts) {
      if (!pattern.heading || !pattern.rule || !pattern.formula ||
          !Array.isArray(pattern.exampleIndices) || !pattern.exampleIndices.length ||
          pattern.exampleIndices.some(i => !Number.isInteger(i) || i < 0 || i > 9))
        throw new Error('Invalid concept in Chapter ' + c.number);
    }
    for (const story of c.storyGroups) {
      if (!story.title || !Array.isArray(story.indices) || story.indices.length < 3 ||
          story.indices.some(i => !Number.isInteger(i) || i < 0 || i > 9))
        throw new Error('Invalid examples in Chapter ' + c.number);
    }
    for (const word of c.supportingWords)
      if (!word.zh || !word.py || !word.en) throw new Error('Missing pinyin/translation in Chapter ' + c.number);
  }
  return true;
}
