import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {VOCAB_BATCH_SIZE,VOCAB_STORAGE_KEY,INTERVALS_DAYS,
  validateVocabDataset,orderVocabulary,selectVocabScope,vocabularyLessons,
  vocabularyRecord,vocabularyProgress,gradeVocabulary,dueVocabulary,
  vocabularyQuestion} from '../js/vocab-model.js';

const file = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const json = path => JSON.parse(file(path));
const dataset = json('data/hsk30/level-1.json');
const notes = json('data/hsk30/context.json');
const book = json('data/packs/hsk-book1-vocabulary.json').cards;

test('2025 exam syllabus Level 1 has 300 complete distinct entries with tone-marked pinyin',()=>{
  assert.equal(validateVocabDataset(dataset),true);
  assert.equal(dataset.words[0].zh,'爱');
  assert.equal(dataset.words[0].py,'ài');
  assert.equal(dataset.words.at(-1).zh,'做饭');
  assert.equal(dataset.words.length,300);
  assert.deepEqual(dataset.words.map(w=>w.seq),Array.from({length:300},(_,i)=>i+1));
  for(const word of dataset.words){
    assert.ok(word.en && !/unknown|todo|placeholder|undefined/i.test(word.en),word.id);
    assert.ok(word.py && word.zh && word.sourcePage>=80 && word.sourcePage<=87,word.id);
  }
  assert.ok(Object.keys(notes.entries).length>=50);
  for(const [zh,ex] of Object.entries(notes.entries)){
    assert.ok(dataset.words.some(word=>word.zh===zh),zh+' should belong to syllabus');
    assert.ok(ex.zh && ex.py && ex.en && ex.note,zh);
  }
});
test('micro-lessons are short, unique and complete; extension excludes existing Book 1 words',()=>{
  const all=vocabularyLessons(dataset.words,book,'all');
  const ordered=orderVocabulary(dataset.words);
  assert.equal(all.length,30);
  assert.equal(all.flatMap(g=>g.words).length,300);
  assert.equal(new Set(ordered.map(w=>w.id)).size,300);
  assert.ok(all.every(l=>l.words.length===VOCAB_BATCH_SIZE));
  const extras=selectVocabScope(dataset.words,book,'extended');
  assert.ok(extras.length>90&&extras.length<300);
  assert.ok(extras.every(w=>!book.some(b=>b.zh===w.zh)));
  const extraBatches=vocabularyLessons(dataset.words,book,'extended');
  assert.deepEqual(extraBatches.flatMap(g=>g.words).map(w=>w.id),
    orderVocabulary(extras).map(w=>w.id));
  assert.ok(extraBatches.every(l=>l.words.length>=1&&l.words.length<=10));
});
test('each word creates four distinct meanings with a correct answer',()=>{
  for(const word of dataset.words){
    for(const count of [0,1]){
      const q=vocabularyQuestion(word,dataset.words,count);
      assert.equal(q.options.length,4,word.id);
      assert.equal(new Set(q.options.map(c=>c.text)).size,4,word.id);
      assert.equal(q.options[q.correctIndex].id,word.id);
    }
  }
});
test('spaced retrieval schedules 1, 3 and 7 days, failures 10 minutes',()=>{
  const now=1_800_000_000_000;
  const word=dataset.words[0],other=dataset.words[1];
  const first=gradeVocabulary({},word.id,true,now);
  assert.equal(vocabularyRecord(first,word.id).seen,1);
  assert.equal(vocabularyRecord(first,word.id).streak,1);
  assert.equal(vocabularyRecord(first,word.id).due,now+86400000);
  assert.equal(dueVocabulary([word],first,now).length,0);
  assert.equal(dueVocabulary([word],first,now+86400000).length,1);
  const second=gradeVocabulary(first,word.id,true,now+86400000);
  assert.equal(vocabularyRecord(second,word.id).due,now+4*86400000);
  const third=gradeVocabulary(second,word.id,true,now+4*86400000);
  assert.equal(vocabularyRecord(third,word.id).due,now+11*86400000);
  assert.deepEqual(INTERVALS_DAYS.slice(0,3),[1,3,7]);
  const wrong=gradeVocabulary(third,word.id,false,now+11*86400000);
  assert.equal(vocabularyRecord(wrong,word.id).due,now+11*86400000+600000);
  assert.equal(vocabularyRecord(wrong,word.id).streak,0);
  assert.equal(vocabularyProgress(wrong,[word,other],now+12*86400000).started,1);
  assert.equal(vocabularyProgress(third,[word,other],now+11*86400000).strong,1);
});
test('older progress backups preserve learning and all earlier storage IDs',async()=>{
  const entries=new Map();
  globalThis.localStorage={
    getItem:key=>entries.has(key)?entries.get(key):null,
    setItem:(key,value)=>entries.set(key,value)
  };
  const store=await import('../js/storage.js');
  assert.equal(store.KEYS.vocabProgress,VOCAB_STORAGE_KEY);
  assert.equal(store.KEYS.history,'mandarim-learning-minimal-v2');
  assert.equal(store.KEYS.stars,'mandarim-stars-v1');
  assert.equal(store.KEYS.settings,'mandarim-settings-v2');
  assert.equal(store.KEYS.reviews,'mandarim-review-events-v1');
  assert.equal(store.KEYS.lessonProgress,'mandarim-chapter-review-v1');
  assert.equal(store.KEYS.listeningProgress,'mandarim-listening-v1');
  store.state.vocabProgress=gradeVocabulary({},dataset.words[0].id,true,1000);
  store.saveVocabProgress();
  const legacy={format:'mandarin-flashcards-progress',version:1,
    history:{foo:{seen:5,due:1234}},stars:{foo:true},
    settings:{audioMuted:false},reviews:[],lessonProgress:{'chapter-11':{bestScore:80}},
    listeningProgress:{time:{best:70}}};
  store.importProgress(legacy);
  assert.equal(store.state.vocabProgress.records[dataset.words[0].id].seen,1);
  assert.equal(store.state.history.foo.seen,5);
  assert.equal(store.state.lessonProgress['chapter-11'].bestScore,80);
  const newBackup=store.exportProgress();
  assert.deepEqual(newBackup.vocabProgress,store.state.vocabProgress);
  store.state.vocabProgress={};
  store.importProgress(newBackup);
  assert.equal(store.state.vocabProgress.records[dataset.words[0].id].seen,1);
  assert.throws(()=>store.importProgress({...legacy,vocabProgress:[]}),/Invalid HSK 3.0/);
});
test('Vocabulary Lab has Practice navigation, protected cues and offline support',()=>{
  const html=file('index.html'),review=file('js/review.js'),lab=file('js/vocab-lab.js'),sw=file('sw.js');
  assert.ok(html.includes('id="vocabView"')&&html.includes('id="vocabRoot"'));
  assert.ok(review.includes("location.hash='vocab'")&&review.includes('initVocabularyLab('));
  assert.ok(lab.includes('Without looking anything up'));
  assert.ok(lab.includes('Pinyin is deliberately hidden.'));
  assert.ok(lab.includes('Reveal meaning'));
  for(const asset of ['js/vocab-lab.js','js/vocab-model.js','data/hsk30/level-1.json','data/hsk30/context.json'])
    assert.ok(sw.includes(asset),asset);
});
