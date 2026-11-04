import assert from 'node:assert/strict';
import test from 'node:test';
import {bankMemberships, compareBanks, matchesBank, resolveBanks} from '../js/banks.js';

const banks = ['HSK 1 · Chapter 1', 'HSK 1 · Chapter 2', 'HSK Book 1 vocabulary'];

test('first visit and saved all-banks mode include every bank', () => {
  assert.deepEqual(resolveBanks({}, banks), banks);
  assert.deepEqual(resolveBanks({topics: 'all'}, banks), banks);
});

test('legacy single-topic preference is migrated without losing the selection', () => {
  assert.deepEqual(resolveBanks({topic: 'HSK 1 · Chapter 2'}, banks), ['HSK 1 · Chapter 2']);
  assert.deepEqual(resolveBanks({topic: 'all'}, banks), banks);
  assert.deepEqual(resolveBanks({topic: 'no-longer-present'}, banks), banks);
});

test('multi-bank preference survives reload and ignores removed banks', () => {
  const selection = ['HSK Book 1 vocabulary', 'HSK 1 · Chapter 1'];
  assert.deepEqual(resolveBanks({topics: selection, topic: 'all'}, banks),
    ['HSK 1 · Chapter 1', 'HSK Book 1 vocabulary']);
  assert.deepEqual(resolveBanks({topics: [...selection, 'removed']}, banks),
    ['HSK 1 · Chapter 1', 'HSK Book 1 vocabulary']);
  assert.deepEqual(resolveBanks({topics: []}, banks), []);
});

test('matching honors multi-bank and legacy single-bank filters', () => {
  const card = {topic: 'HSK 1 · Chapter 2'};
  assert.equal(matchesBank(card, {topics: ['HSK 1 · Chapter 1', 'HSK 1 · Chapter 2']}), true);
  assert.equal(matchesBank(card, {topics: ['HSK 1 · Chapter 1'], topic: 'all'}), false);
  assert.equal(matchesBank(card, {topics: []}), false);
  assert.equal(matchesBank(card, {topics: 'all'}), true);
  assert.equal(matchesBank(card, {topic: 'HSK 1 · Chapter 1'}), false);
  assert.equal(matchesBank(card, {topic: 'HSK 1 · Chapter 2'}), true);
});

test('HSK Book 1 word cards also appear in their lesson bank without new IDs', () => {
  const card = {id:'hsk-book1-vocab-001', topic:'HSK Book 1 vocabulary', lesson:12};
  assert.deepEqual(bankMemberships(card), ['HSK Book 1 vocabulary', 'HSK 1 · Chapter 12']);
  assert.ok(matchesBank(card, {topics:['HSK 1 · Chapter 12']}));
  assert.ok(matchesBank(card, {topics:['HSK Book 1 vocabulary']}));
  assert.ok(matchesBank(card, {topics:['HSK Book 1 vocabulary', 'HSK 1 · Chapter 12']}));
  assert.equal(matchesBank(card, {topics:['HSK 1 · Chapter 11']}), false);
  assert.equal(matchesBank(card, {topic:'HSK 1 · Chapter 12'}), true);
  assert.deepEqual(bankMemberships({topic:'HSK Book 1 vocabulary'}), ['HSK Book 1 vocabulary']);
});

test('HSK Test Prep is an independent bank and can be mixed with chapters', () => {
  const testCard = {topic:'HSK Test Prep', type:'test'};
  assert.ok(matchesBank(testCard, {topics:['HSK Test Prep', 'HSK 1 · Chapter 11']}));
  assert.equal(matchesBank(testCard, {topics:['HSK 1 · Chapter 11']}), false);
});

test('chapter banks sort numerically before other banks', () => {
  const unsorted = ['HSK Test Prep', 'HSK 1 · Chapter 15', 'HSK 1 · Chapter 2',
    'HSK Book 1 vocabulary', 'HSK 1 · Chapter 10', 'Foundation'];
  assert.deepEqual(unsorted.sort(compareBanks), [
    'HSK 1 · Chapter 2', 'HSK 1 · Chapter 10', 'HSK 1 · Chapter 15',
    'Foundation', 'HSK Book 1 vocabulary', 'HSK Test Prep']);
});

test('all 15 chapters appear in numeric order and bank selection remains unchanged', () => {
  const chapterNames = Array.from({length:15}, (_, i) => `HSK 1 · Chapter ${i + 1}`);
  const available = [...chapterNames].reverse().concat('HSK Test Prep').sort(compareBanks);
  assert.deepEqual(available.slice(0, 15), chapterNames);
  const saved = {topics:['HSK 1 · Chapter 12', 'HSK 1 · Chapter 2', 'HSK Test Prep']};
  assert.deepEqual(resolveBanks(saved, available), [
    'HSK 1 · Chapter 2', 'HSK 1 · Chapter 12', 'HSK Test Prep']);
});
