import assert from 'node:assert/strict';
import test from 'node:test';
import {bankMemberships, matchesBank, resolveBanks} from '../js/banks.js';

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
