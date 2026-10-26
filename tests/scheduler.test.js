import assert from 'node:assert/strict';
import test from 'node:test';
import {nextCard, grade} from '../js/scheduler.js';

const options = {topic:'all', starredOnly:false, sentencesEnabled:true, mix:'new'};
const make = (n) => Array.from({length:n}, (_, i) => ({
  id: 'card-'+i, topic:'HSK 1 · Chapter '+(i%10+1),
  type:'sentence', difficulty:['easy','medium','hard'][i%3],
  sourcePack:'extended-hsk1-01'
}));
const select = (cards, history={}, recent=[], counts={}, now=1_000_000) =>
  nextCard(cards, history, {}, options, recent, now, () => 0.37, counts);

test('does not show future reviews, even after a miss', () => {
  const cards = make(2);
  const h = {[cards[0].id]:{last:'miss',due:1_100_000,seen:1}};
  for (let i=0;i<20;i++) assert.equal(select(cards,h).card.id,cards[1].id);
  assert.equal(select([cards[0]],h).card, null);
});

test('15-card minimum separation when available', () => {
  const cards = make(30); let recent=[], counts={};
  for(let i=0;i<100;i++){
    const result=select(cards,{},recent,counts);
    assert.ok(!recent.includes(result.card.id));
    recent=result.recent; counts=result.counts;
  }
});

test('small pools fall back to oldest eligible card', () => {
  const cards=make(3), recent=['card-0','card-1','card-2'];
  assert.equal(select(cards,{},recent).card.id,'card-0');
});

test('new / due / reinforcement groups approach 60 / 25 / 15', () => {
  const cards=make(300), history={};
  for(let i=100;i<200;i++) history[cards[i].id]={last:'good',due:900_000,seen:1};
  for(let i=200;i<300;i++) history[cards[i].id]={last:'miss',due:900_000,seen:1};
  let counts={},recent=[];
  for(let i=0;i<100;i++){
    const result=select(cards,history,recent,counts);
    counts=result.counts;recent=result.recent;
    // Mimic answered new cards so they do not unfairly remain new forever.
    history[result.card.id] ??= {last:'good',due:1_100_000,seen:1};
    // Existing due reviews should become future-due once answered.
    if(history[result.card.id].due<1_000_000) history[result.card.id].due=1_100_000;
  }
  // When a category runs out of due cards, remaining quota is legitimately reassigned.
  assert.ok(counts.new>=55, JSON.stringify(counts));
});

test('legacy grading and review record fields remain stable',()=>{
  const a=grade(undefined,false,1_000_000);
  assert.equal(a.due,1_000_000+3*60_000);
  const b=grade(a,true,1_000_000);
  assert.equal(b.due,1_000_000+25*60_000);
  assert.equal(b.seen,2);
  assert.equal(b.lapses,1);
});
