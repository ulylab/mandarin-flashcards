import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {buildChapterReviewLesson,validateLessonCatalog,REVIEW_CHAPTERS} from '../js/review-curriculum.js';
import {checkReviewAnswer,validateReviewLesson,chapterState,recordVisited} from '../js/review-model.js';

const load = file=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const source = file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const catalog=load('data/lessons/catalog.json');
const vocab=load('data/packs/hsk-book1-vocabulary.json').cards;
const sentences=[...load('data/packs/hsk-chapters-01-10.json').cards,...load('data/packs/hsk-chapters-11-15.json').cards];
const pilot=load('data/lessons/chapter-11.json');

test('all fifteen chapters have a five-screen lesson; numbering is numeric',()=>{
 assert.equal(validateLessonCatalog(catalog),true);
 assert.deepEqual(REVIEW_CHAPTERS.map(c=>c.number),Array.from({length:15},(_,i)=>i+1));
 assert.equal(new Set(REVIEW_CHAPTERS.map(c=>c.id)).size,15);
 assert.equal(validateReviewLesson(pilot),true);
 for(const c of catalog.chapters){
   const lesson=buildChapterReviewLesson(c,
     sentences.filter(s=>s.topic==='HSK 1 · Chapter '+c.number),
     vocab.filter(w=>w.lesson===c.number));
   assert.equal(validateReviewLesson(lesson),true,'lesson '+c.number);
   assert.equal(lesson.stories.length,2);
   assert.equal(lesson.stories.flatMap(s=>s.lines).length,10);
   assert.equal(lesson.concepts.length,3);
   assert.equal(lesson.practice.length,8);
   assert.equal(lesson.challenge.length,10);
   assert.equal(new Set([...lesson.practice,...lesson.challenge].map(q=>q.id)).size,18);
   for(const question of [...lesson.practice,...lesson.challenge]){
     if(question.kind==='choice'){
       assert.equal(new Set(question.options).size,question.options.length,'duplicate options '+c.number+'/'+question.id);
       assert.equal(checkReviewAnswer(question,question.answer),true);
       assert.equal(checkReviewAnswer(question,(question.answer+1)%question.options.length),false);
     } else if(question.kind==='order'){
       assert.equal(checkReviewAnswer(question,question.answer),true);
       const notIt=[...question.answer].reverse();
       if(notIt.some((v,i)=>v!==question.answer[i]))
         assert.equal(checkReviewAnswer(question,notIt),false);
     } else if(question.kind==='input'){
       assert.equal(checkReviewAnswer(question,question.answers[0]),true);
       assert.equal(checkReviewAnswer(question,question.answers[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()),true);
     }
   }
 }
});

test('chapter progress is independent per chapter and preserves existing Chapter 11',()=>{
 const all={'chapter-11':{visited:[0,1,2,3,4],bestScore:90,latestScore:80,attempts:4}};
 const first=recordVisited(chapterState(all,'chapter-01'),0);
 all['chapter-01']=first;
 assert.deepEqual(chapterState(all,'chapter-01').visited,[0]);
 assert.deepEqual(chapterState(all,'chapter-11').visited,[0,1,2,3,4]);
 assert.equal(chapterState(all,'chapter-11').bestScore,90);
});

test('header has Settings left, mode tabs in header, and audio setting in Settings',()=>{
 const html=source('index.html');
 const head=html.slice(html.indexOf('<header class="top">'),html.indexOf('</header>'));
 assert.ok(head.indexOf('id="settingsBtn"')<head.indexOf('id="cardsTab"'));
 assert.ok(head.indexOf('id="cardsTab"')<head.indexOf('id="reviewTab"'));
 assert.ok(!head.includes('MANDARIN'));
 assert.ok(!head.includes('id="muteBtn"'));
 assert.ok(html.includes('id="autoAudio"'));
 const app=source('js/app.js');
 assert.ok(app.includes("$('autoAudio').checked = !audioMuted"));
 assert.ok(app.includes("audioMuted = !$('autoAudio').checked"));
});

test('chapter review assets are cached offline and all original flashcard storage keys persist',async()=>{
 const cache=source('sw.js');
 for(const filename of ['data/lessons/catalog.json','data/lessons/chapter-11.json','js/review-curriculum.js','js/review.js','css/review.css'])
   assert.ok(cache.includes(filename),filename);
 globalThis.localStorage={getItem(){return null},setItem(){}};
 const store=await import('../js/storage.js');
 assert.equal(store.KEYS.history,'mandarim-learning-minimal-v2');
 assert.equal(store.KEYS.stars,'mandarim-stars-v1');
 assert.equal(store.KEYS.settings,'mandarim-settings-v2');
 assert.equal(store.KEYS.reviews,'mandarim-review-events-v1');
 assert.equal(store.KEYS.lessonProgress,'mandarim-chapter-review-v1');
});
