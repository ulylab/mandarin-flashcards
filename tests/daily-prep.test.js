import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {buildDailyQuestions} from '../js/daily-prep.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const words=JSON.parse(read('data/hsk30/level-1.json')).words;
const manifest=JSON.parse(read('data/manifest.json'));
const cards=manifest.packs.flatMap(p=>JSON.parse(read(p.file)).cards);
test('daily HSK 3.0 session covers four question types and 25 graded items',()=>{
 const q=buildDailyQuestions(words,cards,'2026-11-09');
 assert.equal(q.length,25);
 assert.deepEqual([0,1,2,3].map(stage=>q.filter(x=>x.stage===stage).length),[8,6,6,5]);
 assert.equal(new Set(q.map(x=>x.id)).size,25);
 for(const question of q){
   assert.equal(question.options.length,4,question.id);
   assert.equal(new Set(question.options).size,4,question.id);
   assert.ok(question.options.includes(question.answer),question.id);
   assert.ok(question.explain.includes(question.zh));
   assert.ok(question.py && question.translation);
 }
});
test('daily content is reproducible within a day and varies by date',()=>{
 const a=buildDailyQuestions(words,cards,'2026-11-09');
 const b=buildDailyQuestions(words,cards,'2026-11-09');
 const c=buildDailyQuestions(words,cards,'2026-11-10');
 assert.deepEqual(a,b);
 assert.notDeepEqual(a.map(q=>q.zh),c.map(q=>q.zh));
});
test('progress key is independent and older backups retain existing daily results',async()=>{
 const storage=new Map();
 globalThis.localStorage={
  getItem:key=>storage.get(key)??null,
  setItem:(key,val)=>storage.set(key,val)
 };
 const store=await import('../js/storage.js');
 assert.equal(store.KEYS.dailyProgress,'mandarim-hsk30-daily-v1');
 store.state.dailyProgress={'2026-11-09':{startedAt:1000,answers:{'0-0':{correct:true}}}};
 store.saveDailyProgress();
 store.importProgress({format:'mandarin-flashcards-progress',version:1,history:{},stars:{},settings:{},reviews:[]});
 assert.ok(store.state.dailyProgress['2026-11-09']);
 assert.deepEqual(store.exportProgress().dailyProgress,store.state.dailyProgress);
});
test('navigation and offline assets include daily preparation',()=>{
 assert.match(read('index.html'),/id="dailyView"/);
 assert.match(read('js/review.js'),/dailyUI\.route\(\)/);
 assert.match(read('sw.js'),/js\/daily-prep\.js/);
});
