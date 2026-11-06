import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {LISTENING_MODULES,LISTENING_LEVELS,LISTENING_COUNT,LISTENING_STORAGE_KEY,
  listeningStats,buildListeningSession,gradeListeningAnswer,finishListeningSession}
  from '../js/listening-model.js';
const source = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const json = path => JSON.parse(source(path));
const manifest=json('data/manifest.json');
const cards=manifest.packs.flatMap(({file})=>json(file).cards);
const chapterSentences=cards.filter(c=>c.type==='sentence' && /^HSK 1 · Chapter \d+$/.test(c.topic));

test('listening uses existing verified HSK sentence banks only',()=>{
  assert.equal(chapterSentences.length,150);
  assert.equal(LISTENING_MODULES.length,6);
  assert.deepEqual(LISTENING_LEVELS.map(x=>x.id),['easy','everyday','challenge']);
  assert.equal(LISTENING_COUNT,5);
  for(const module of LISTENING_MODULES){
    for(const level of LISTENING_LEVELS){
      const questions=buildListeningSession(cards,module.id,level.id,{});
      assert.equal(questions.length,5,module.id+'/'+level.id);
      assert.equal(new Set(questions.map(q=>q.id)).size,5);
      for(const q of questions){
        assert.ok(module.chapters.includes(q.chapter));
        assert.ok(chapterSentences.some(c=>String(c.id)===q.id && c.zh===q.zh && c.py===q.py && c.en===q.en));
        assert.ok(q.zh && q.py && q.en && q.breakdown.length);
        assert.equal(q.choices.length,3);
        assert.equal(new Set(q.choices).size,3,module.id+'/'+level.id+'/'+q.id);
        assert.equal(q.choices[q.correctIndex],q.en);
        assert.equal(gradeListeningAnswer(q,q.correctIndex),true);
        assert.equal(gradeListeningAnswer(q,(q.correctIndex+1)%3),false);
      }
    }
  }
});

test('progress is scored per module, retains missed cards and encourages variety',()=>{
  const one=buildListeningSession(cards,'time','easy',{});
  const answers=one.map((q,i)=>i===0?q.correctIndex:((q.correctIndex+1)%3));
  const saved=finishListeningSession({},'time',one,answers,12345);
  const stats=listeningStats(saved,'time');
  assert.equal(stats.latest,20);
  assert.equal(stats.best,20);
  assert.equal(stats.correct,1);
  assert.equal(stats.answered,5);
  assert.equal(stats.attempts,1);
  assert.equal(stats.recent.length,5);
  const more=buildListeningSession(cards,'time','easy',saved);
  assert.equal(more.length,5);
  assert.ok(more.some(q=>!one.some(first=>first.id===q.id)),'new session should rotate listening prompts');
  const excellent=finishListeningSession(saved,'time',more,more.map(q=>q.correctIndex),23456);
  assert.equal(listeningStats(excellent,'time').best,100);
  assert.equal(listeningStats(excellent,'time').latest,100);
  assert.equal(listeningStats(excellent,'time').attempts,2);
  assert.equal(listeningStats(excellent,'food').attempts,0);
  assert.equal(gradeListeningAnswer(one[0],null),false);
});

test('legacy, current and listening progress backups remain compatible',async()=>{
  const map=new Map();
  globalThis.localStorage={
    getItem:key=>map.has(key)?map.get(key):null,
    setItem:(key,value)=>map.set(key,value),
    removeItem:key=>map.delete(key)
  };
  const store=await import('../js/storage.js');
  assert.equal(store.KEYS.listeningProgress,LISTENING_STORAGE_KEY);
  assert.equal(store.KEYS.history,'mandarim-learning-minimal-v2');
  assert.equal(store.KEYS.stars,'mandarim-stars-v1');
  assert.equal(store.KEYS.lessonProgress,'mandarim-chapter-review-v1');
  store.state.listeningProgress={time:{attempts:2,latest:80,best:90,recent:['a']}};
  store.saveListeningProgress();
  const old={format:'mandarin-flashcards-progress',version:1,
    history:{'hsk-book1-vocab-015':{seen:6,due:1234}},
    stars:{'hsk-book1-vocab-015':true},settings:{audioMuted:true},
    reviews:[],lessonProgress:{'chapter-11':{visited:[0,1],bestScore:80}}};
  store.importProgress(old);
  assert.equal(store.state.history['hsk-book1-vocab-015'].seen,6);
  assert.equal(store.state.listeningProgress.time.best,90);
  assert.equal(store.state.lessonProgress['chapter-11'].bestScore,80);
  const exported=store.exportProgress();
  assert.deepEqual(exported.listeningProgress,store.state.listeningProgress);
  store.state.listeningProgress={};
  store.importProgress(exported);
  assert.equal(store.state.listeningProgress.time.latest,80);
  assert.throws(()=>store.importProgress({...old,listeningProgress:[]}),/Invalid listening progress/);
});

test('Practice hub and Listening Trainer are wired into app and offline cache',()=>{
  const html=source('index.html');
  assert.ok(html.includes('>Practice</button>'));
  assert.ok(html.includes('id="reviewRoot"'));
  assert.ok(html.includes('id="listeningRoot"'));
  const review=source('js/review.js');
  assert.ok(review.includes("location.hash='review/chapters'"));
  assert.ok(review.includes("location.hash='listen'"));
  assert.ok(review.includes("location.hash='review/chapters';"));
  assert.ok(review.includes('initListening('));
  const listen=source('js/listening.js');
  assert.ok(listen.includes("playAudio(question.zh,rate)"));
  assert.ok(listen.includes('The Chinese sentence is hidden until you answer.'));
  assert.ok(listen.includes('CHINESE TRANSCRIPT'));
  assert.ok(listen.includes('Cannot hear? Reveal and skip'));
  const app=source('js/app.js');
  assert.ok(app.includes('utterance.rate = Math.max('));
  const sw=source('sw.js');
  for(const p of ['js/listening.js','js/listening-model.js','js/review.js','data/manifest.json'])
    assert.ok(sw.includes(p),p);
});
