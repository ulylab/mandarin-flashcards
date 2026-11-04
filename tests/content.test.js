import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {bankMemberships, matchesBank} from '../js/banks.js';
import {nextCard} from '../js/scheduler.js';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const manifest = read('data/manifest.json');
const packs = manifest.packs.map(({id,file}) => {
  const data = read(file);
  assert.equal(data.id, id, file);
  return data;
});
const all = packs.flatMap(pack => pack.cards);

test('every pack is registered, parseable, and card IDs remain unique', () => {
  assert.equal(new Set(manifest.packs.map(p => p.id)).size, manifest.packs.length);
  assert.equal(new Set(all.map(c => String(c.id))).size, all.length);
  assert.equal(all.length, 794);
  assert.equal(all.filter(c => !['sentence','test'].includes(c.type)).length, 504);
});

test('HSK Standard Course has ten chapter sentence cards for each of 15 lessons', () => {
  for (let lesson = 1; lesson <= 15; lesson++) {
    const topic = `HSK 1 · Chapter ${lesson}`;
    const sentences = all.filter(c => c.type === 'sentence' && c.topic === topic);
    assert.equal(sentences.length, 10, topic);
    for (const card of sentences) {
      assert.ok(card.breakdown.length > 0, card.id);
      assert.equal(card.zh.replace(/[，。？！]/g, ''), card.breakdown.map(t => t.zh).join(''), card.id);
    }
  }
});

test('book vocabulary is chapter-selectable through lesson 15 without duplicate exposure', () => {
  const words = all.filter(c => c.topic === 'HSK Book 1 vocabulary');
  assert.equal(words.length, 169);
  for (let lesson = 11; lesson <= 15; lesson++) {
    const topic = `HSK 1 · Chapter ${lesson}`;
    const selected = words.filter(w => matchesBank(w, {topics:[topic]}));
    assert.ok(selected.length >= 5, topic);
    assert.ok(selected.every(w => w.lesson === lesson));
  }
  assert.ok(words.some(w => bankMemberships(w).length === 1));
});

test('40 original test prep questions: audio-first listening, reading, 3 unique options', () => {
  const questions = all.filter(c => c.type === 'test');
  assert.equal(questions.length, 40);
  for (const section of ['listening', 'reading']) {
    assert.equal(questions.filter(c => c.section === section).length, 20);
  }
  for (const card of questions) {
    assert.equal(card.topic, 'HSK Test Prep');
    assert.equal(card.choices.length, 3);
    assert.equal(new Set(card.choices).size, 3);
    assert.ok(Number.isInteger(card.answer) && card.answer >= 0 && card.answer < 3);
    assert.ok(card.py && card.zh && card.en && card.explanation);
  }
});

test('scheduler selects HSK prep and chapter cards from combined banks', () => {
  const opts = {topics:['HSK Test Prep','HSK 1 · Chapter 14'],sentencesEnabled:true,mix:'new'};
  let counts={},recent=[];
  let sawTest=false,sawChapter=false;
  for (let i=0;i<80;i++){
    const result=nextCard(all,{}, {},opts,recent,1_000_000,()=> (i%13)/13, counts);
    assert.ok(result.card);
    assert.ok(matchesBank(result.card,opts));
    if(result.card.type==='test')sawTest=true;
    if(result.card.topic==='HSK 1 · Chapter 14' || result.card.lesson===14)sawChapter=true;
    recent=result.recent;counts=result.counts;
  }
  assert.ok(sawTest && sawChapter);
});
