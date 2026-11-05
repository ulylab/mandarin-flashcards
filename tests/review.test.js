import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {checkReviewAnswer, normalizePinyin, validateReviewLesson, chapterState,
  recordVisited, recordPractice, recordChallenge} from '../js/review-model.js';

const file = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const lesson = JSON.parse(file('data/lessons/chapter-11.json'));

test('chapter 11 pilot contains all five complete learning screens', () => {
  assert.equal(validateReviewLesson(lesson), true);
  assert.equal(lesson.number, 11);
  assert.equal(lesson.concepts.length, 4);
  assert.equal(lesson.stories.length, 2);
  assert.equal(lesson.practice.length, 8);
  assert.equal(lesson.challenge.length, 10);
  assert.equal(new Set([...lesson.practice,...lesson.challenge].map(q=>q.id)).size, 18);
  assert.ok(lesson.concepts.some(c=>c.heading.includes('First')));
  assert.ok(lesson.supportingWords.some(word=>word.zh === '下午' && word.py === 'xiàwǔ'));
});

test('multiple-choice, word ordering and pinyin are graded accurately', () => {
  const choice = lesson.practice.find(q=>q.kind==='choice');
  assert.equal(checkReviewAnswer(choice,choice.answer), true);
  assert.equal(checkReviewAnswer(choice,(choice.answer + 1) % choice.options.length), false);
  const order = lesson.practice.find(q=>q.kind==='order');
  assert.equal(checkReviewAnswer(order,order.answer), true);
  assert.equal(checkReviewAnswer(order,[...order.answer].reverse()), false);
  const input = lesson.challenge.find(q=>q.id==='c10');
  assert.equal(checkReviewAnswer(input,'shuì jiào'), true);
  assert.equal(checkReviewAnswer(input,'SHUI JIAO'), true);
  assert.equal(checkReviewAnswer(input,'shui jiao ma'), false);
  assert.equal(normalizePinyin('Rán hòu!'), 'ranhou');
});

test('chapter visits and challenge mastery do not alter flashcard objects', () => {
  const flashcardHistory = {abc:{seen:13,due:98765}};
  const before = JSON.stringify(flashcardHistory);
  const original = chapterState({}, lesson.id);
  const visited = recordVisited(recordVisited(original,1),1);
  assert.deepEqual(visited.visited,[1]);
  const practiced = recordPractice(visited,'p1',false);
  const retried = recordPractice(practiced,'p1',true);
  assert.deepEqual(retried.practice.p1,{attempts:2,correct:true});
  const finished = recordChallenge(retried,8,10,123456);
  assert.equal(finished.bestScore,80);
  assert.equal(finished.latestScore,80);
  assert.equal(finished.attempts,1);
  const lower = recordChallenge(finished,6,10,123457);
  assert.equal(lower.bestScore,80);
  assert.equal(lower.latestScore,60);
  assert.equal(lower.attempts,2);
  assert.equal(JSON.stringify(flashcardHistory),before);
});

test('navigation, lesson stylesheet and offline cache are connected', () => {
  const index = file('index.html');
  const app = file('js/app.js');
  const sw = file('sw.js');
  assert.match(index,/id="cardsTab"/);
  assert.match(index,/id="reviewTab"/);
  assert.match(index,/id="reviewView"/);
  assert.match(index,/href="css\/review\.css"/);
  assert.match(app,/initReview\(/);
  assert.match(app,/if \(\$\('flashcardsView'\)\.hidden\) return/);
  for (const path of ['js/review.js','js/review-model.js','css/review.css','data/lessons/chapter-11.json']) {
    assert.ok(sw.includes(path), 'offline cache must include ' + path);
  }
});

test('legacy backups keep lesson progress; new backups include it', async () => {
  const entries = new Map();
  globalThis.localStorage = {
    getItem:key=>entries.get(key)??null,
    setItem:(key,value)=>{entries.set(key,value);},
    removeItem:key=>{entries.delete(key);}
  };
  const store = await import('../js/storage.js');
  assert.equal(store.KEYS.history,'mandarim-learning-minimal-v2');
  assert.equal(store.KEYS.reviews,'mandarim-review-events-v1');
  assert.equal(store.KEYS.lessonProgress,'mandarim-chapter-review-v1');
  store.state.lessonProgress={'chapter-11':{bestScore:90}};
  store.saveLessonProgress();
  const legacy = {format:'mandarin-flashcards-progress',version:1,
    history:{'hsk-book1-vocab-015':{seen:3,last:'know',due:1234}},
    stars:{'hsk-book1-vocab-015':true},settings:{mix:'new'},reviews:[]};
  store.importProgress(legacy);
  assert.equal(store.state.history['hsk-book1-vocab-015'].seen,3);
  assert.equal(store.state.lessonProgress['chapter-11'].bestScore,90);
  const exported = store.exportProgress();
  assert.deepEqual(exported.lessonProgress,store.state.lessonProgress);
  store.state.lessonProgress={};
  store.importProgress(exported);
  assert.equal(store.state.lessonProgress['chapter-11'].bestScore,90);
  const ui = await import('../js/review.js');
  assert.equal(typeof ui.initReview,'function');
});
