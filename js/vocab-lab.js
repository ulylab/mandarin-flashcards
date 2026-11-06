import {state,saveVocabProgress} from './storage.js';
import {VOCAB_BATCH_SIZE,validateVocabDataset,selectVocabScope,vocabularyLessons,
  vocabularyProgress,vocabularyRecord,dueVocabulary,gradeVocabulary,vocabularyQuestion}
  from './vocab-model.js';

const node=(tag,cls='',value=null)=>{
  const item=document.createElement(tag);
  if(cls)item.className=cls;
  if(value!==null)item.textContent=value;
  return item;
};
const button=(label,cls,callback)=>{
  const b=node('button',cls,label);b.type='button';b.addEventListener('click',callback);return b;
};
const addText=(parent,cls,value)=>parent.append(node('p',cls,value));
const MAIN='main';

export function initVocabularyLab({getCards,playAudio,stopAudio,canPlayAudio}){
  const root=document.getElementById('vocabRoot'),view=document.getElementById('vocabView');
  if(!root||!view)return {route(){},refresh(){}};
  let dataset=null,contexts=null,loading=null,error='';
  let scope='extended';
  let routeId='';
  let mode='home',lessonNumber=0,studyIndex=0;
  let sessionWords=[],sessionIndex=0,sessionCorrect=[],selected=null,shown=false,graded=false;
  const all=()=>dataset?.words||[];
  const currentWords=()=>selectVocabScope(all(),getCards(),scope);
  const batches=()=>vocabularyLessons(all(),getCards(),scope);
  const stats=words=>vocabularyProgress(state.vocabProgress,words);
  const home=()=>{location.hash='vocab';};
  const changeRoute=(next)=>{location.hash=next;};
  const speak=(zh,slow=false)=>{if(canPlayAudio)playAudio(zh,slow?0.65:0.85);};
  function saveAnswer(word,correct){
    state.vocabProgress=gradeVocabulary(state.vocabProgress,word.id,correct);
    saveVocabProgress();
  }
  function contextFor(word){
    const curated=contexts?.entries?.[word.zh];
    if(curated)return curated;
    const matched=getCards().find(c=>c.zh===word.zh && c.type!=='sentence' &&
      c.type!=='test' && Array.isArray(c.examples) && c.examples.length);
    const sample=matched?.examples?.[0];
    return sample?{zh:sample[0],py:sample[1],en:sample[2]}:null;
  }
  function sound(parent,zh){
    const audio=button('▶ Listen','vocab-listen',()=>speak(zh));
    audio.disabled=!canPlayAudio;
    audio.setAttribute('aria-label','Listen to '+zh+' in Mandarin');
    parent.append(audio);
  }
  function wordDetails(parent,word,full=true){
    const info=node('div','vocab-detail');
    const title=node('div','vocab-chinese',word.zh);
    title.lang='zh-Hans';
    info.append(title);
    info.append(node('div','vocab-pinyin',word.py));
    info.append(node('div','vocab-meaning',word.en));
    if(word.pos)info.append(node('div','vocab-pos',word.pos));
    if(full){
      const ex=contextFor(word);
      if(ex){
        const sample=node('div','vocab-example');
        sample.append(node('p','review-section-label','IN CONTEXT'));
        const zh=node('div','vocab-example-zh',ex.zh);zh.lang='zh-Hans';
        sample.append(zh,node('div','vocab-example-pinyin',ex.py),
          node('div','vocab-example-en',ex.en));
        if(ex.note)addText(sample,'vocab-learning-note',ex.note);
        info.append(sample);
        const listen=button('▶ Hear example','review-small-button',()=>speak(ex.zh));
        listen.disabled=!canPlayAudio;
        sample.append(listen);
      }else{
        addText(info,'vocab-learning-note','Say this word aloud, then cover the meaning and try to retrieve it from memory.');
      }
    }
    parent.append(info);
  }
  function intro(parent,subtitle){
    const block=node('div','review-home-intro');
    block.append(node('p','review-kicker','HSK 3.0 · 2025 EXAM SYLLABUS'));
    block.append(node('h1','','Vocabulary Lab'));
    addText(block,'',subtitle);
    parent.append(block);
  }
  function loadingView(){
    intro(root,'Learn in small batches, test your memory, then revisit words at spaced intervals.');
    const p=node('div','review-panel');
    addText(p,'review-description',error || 'Loading the 300-word syllabus…');
    if(error)p.append(button('Try again','review-action',()=>{error='';loading=null;ensure().then(render).catch(render);}));
    root.append(p);
  }
  function scopeControls(){
    const bar=node('div','vocab-scope');
    const known=new Set(getCards().filter(c=>c.topic==='HSK Book 1 vocabulary').map(c=>c.zh));
    const extra=all().filter(w=>!known.has(w.zh)).length;
    const options=[['extended','Beyond my book · '+extra],['all','All 300 words']];
    for(const [id,text] of options){
      const b=button(text,'vocab-scope-button'+(id===scope?' is-selected':''),()=>{
        scope=id;render();
      });
      b.setAttribute('aria-pressed',String(id===scope));bar.append(b);
    }
    return bar;
  }
  function homeView(){
    root.append(button('← Practice','review-small-button review-back',()=>changeRoute('review')));
    intro(root,'An evidence-informed routine: first see a word with its pronunciation and meaning, retrieve it without cues, then review it days later.');
    root.append(scopeControls());
    const current=currentWords(),tally=stats(current),grid=node('div','vocab-stats');
    for(const [value,label] of [[current.length,'Words in focus'],[tally.started,'Attempted'],[tally.due,'Due now'],[tally.strong,'3+ recall successes']]){
      const cell=node('div','vocab-stat');
      cell.append(node('strong','',String(value)),node('span','',label));grid.append(cell);
    }
    root.append(grid);
    const due=button('Review due words ('+tally.due+')','review-action vocab-review-button',()=>
      changeRoute('vocab/review/'+scope));
    due.disabled=tally.due===0;
    root.append(due);
    const help=node('div','review-panel vocab-method');
    help.append(node('p','review-section-label','HOW YOU LEARN'));
    addText(help,'','1 · Explore a 10-word group with Mandarin audio and English explanations.');
    addText(help,'','2 · Recall meanings without pinyin; get immediate corrective feedback.');
    addText(help,'','3 · Return when words are due: next day, then 3, 7, 14 days and beyond.');
    addText(help,'vocab-learning-note','“Beyond my book” compares the new syllabus with your existing HSK Book 1 vocabulary cards. It is not a claim that every selected word is new to the official exam.');
    root.append(help);
    root.append(node('h2','vocab-section-title','10-word micro-lessons'));
    const listing=node('div','vocab-lesson-grid');
    for(const group of batches()){
      const started=group.words.filter(w=>vocabularyRecord(state.vocabProgress,w.id).seen>0).length;
      const part=button('','vocab-lesson-button',()=>{
        changeRoute('vocab/lesson/'+scope+'/'+group.number);
      });
      part.setAttribute('aria-label','Open vocabulary lesson '+group.number);
      part.append(node('span','review-chapter-num','LESSON '+String(group.number).padStart(2,'0')+' · '+group.words.length+' WORDS'));
      part.append(node('span','vocab-lesson-name',group.title));
      const preview=group.words.slice(0,5).map(w=>w.zh).join(' · ');
      part.append(node('span','vocab-preview',preview));
      part.append(node('span','review-chapter-meta',started+'/'+group.words.length+' attempted'));
      listing.append(part);
    }
    root.append(listing);
    addText(root,'vocab-credit','Vocabulary: November 2025 HSK examination syllabus. Teaching glosses and examples are supplemental English learning aids, not official translations.');
  }
  function lessonView(){
    const lesson=batches()[lessonNumber-1];
    if(!lesson){home();return;}
    root.append(button('← All lessons','review-small-button review-back',home));
    root.append(node('p','review-kicker','LESSON '+lesson.number+' · '+lesson.words.length+' WORDS'));
    root.append(node('h1','vocab-section-title',lesson.title));
    addText(root,'review-note','Explore the meaning and pronunciation, then use the recall exercise. Nothing is recorded as learned until you answer.');
    const count=node('div','listen-count');
    count.append(node('strong','', 'Word '+(studyIndex+1)+' of '+lesson.words.length));
    const track=node('div','review-progress-track');
    const fill=node('span','review-progress-fill');
    fill.style.width=((studyIndex+1)/lesson.words.length*100)+'%';track.append(fill);count.append(track);root.append(count);
    const panel=node('section','review-panel vocab-study');
    const word=lesson.words[studyIndex];
    const speech=node('div','vocab-word-audio');
    sound(speech,word.zh);panel.append(speech);
    wordDetails(panel,word);
    const nav=node('div','vocab-study-nav');
    if(studyIndex>0)nav.append(button('← Previous','review-small-button',()=>{studyIndex--;render();}));
    if(studyIndex<lesson.words.length-1)
      nav.append(button('Next word →','review-action',()=>{studyIndex++;render();}));
    else nav.append(button('Start recall practice →','review-action',()=>{
      beginQuiz(lesson.words,'lesson');
    }));
    panel.append(nav);root.append(panel);
  }
  function beginQuiz(words,type){
    stopAudio();sessionWords=[...words];sessionIndex=0;sessionCorrect=[];
    selected=null;shown=false;graded=false;mode=type==='due'?'due-quiz':'lesson-quiz';
    render();
  }
  function quizWord(){
    return sessionWords[sessionIndex];
  }
  function revealGrade(correct){
    if(graded)return;
    const w=quizWord();
    saveAnswer(w,correct);
    sessionCorrect.push(correct);
    shown=true;graded=true;stopAudio();render();
  }
  function nextQuiz(){
    if(!graded)return;
    sessionIndex++;
    selected=null;shown=false;graded=false;
    if(sessionIndex>=sessionWords.length)mode='done';
    render();
  }
  function questionView(){
    const word=quizWord();
    if(!word){mode='done';render();return;}
    root.append(button('← End session','review-small-button review-back',home));
    const box=node('div','listen-count');
    box.append(node('strong','', 'Recall '+(sessionIndex+1)+' / '+sessionWords.length));
    const track=node('div','review-progress-track');
    const fill=node('span','review-progress-fill');
    fill.style.width=(sessionIndex/sessionWords.length*100)+'%';
    track.append(fill);box.append(track);root.append(box);
    const panel=node('section','review-panel vocab-quiz');
    panel.append(node('p','review-kicker',mode==='due-quiz'?'SPACED RECALL':'FIRST RETRIEVAL'));
    const text=node('div','vocab-quiz-prompt',word.zh);text.lang='zh-Hans';
    panel.append(text);
    sound(panel,word.zh);
    const rec=vocabularyRecord(state.vocabProgress,word.id);
    const isRecall=rec.seen>0;
    if(!shown){
      if(isRecall){
        addText(panel,'vocab-quiz-directions','Without looking anything up, say the English meaning aloud or in your head. Then reveal it.');
        panel.append(button('Reveal meaning','review-action vocab-wide',()=>{
          shown=true;render();
        }));
      }else{
        addText(panel,'vocab-quiz-directions','Recall the meaning before looking at the choices. Pinyin is deliberately hidden.');
        const quiz=vocabularyQuestion(word,all(),rec.seen);
        const options=node('div','vocab-choices');
        quiz.options.forEach((option,i)=>{
          const choice=button(String.fromCharCode(65+i)+'. '+option.text,
            'vocab-choice'+(selected===i?' is-selected':''),()=>{selected=i;render();});
          choice.setAttribute('aria-pressed',String(selected===i));options.append(choice);
        });
        panel.append(options);
        const check=button('Check answer','review-action vocab-wide',()=>{
          if(selected===null)return;
          revealGrade(selected===quiz.correctIndex);
        });
        check.disabled=selected===null;panel.append(check);
      }
    }else{
      const feedback=node('div','vocab-feedback');
      if(graded){
        feedback.classList.add(sessionCorrect[sessionCorrect.length-1]?'is-right':'is-missed');
        feedback.append(node('strong','',sessionCorrect[sessionCorrect.length-1]?'Correct':'Needs practice'));
        addText(feedback,'',sessionCorrect[sessionCorrect.length-1]?'Next review scheduled.':'This word will return sooner.');
      }else{
        addText(feedback,'vocab-learning-note','Compare your answer with the meaning below before grading yourself.');
      }
      panel.append(feedback);
      wordDetails(panel,word);
      if(!graded){
        const controls=node('div','vocab-grade-controls');
        controls.append(button('Need practice','review-small-button vocab-missed',()=>revealGrade(false)),
          button('I recalled it','review-action',()=>revealGrade(true)));
        panel.append(controls);
      }else{
        panel.append(button(sessionIndex===sessionWords.length-1?'See session summary':'Next word →',
          'review-action vocab-wide',nextQuiz));
      }
    }
    root.append(panel);
  }
  function doneView(){
    root.append(button('← All lessons','review-small-button review-back',home));
    const right=sessionCorrect.filter(Boolean).length;
    const panel=node('section','review-panel vocab-results');
    panel.append(node('p','review-kicker','SESSION COMPLETE'));
    panel.append(node('h1','',right+' / '+sessionWords.length+' remembered'));
    addText(panel,'review-description','Correct words are scheduled for spaced review. Missed words return after ten minutes.');
    const now=stats(currentWords());
    addText(panel,'vocab-learning-note',now.due+' words due now · '+now.started+' words attempted in this focus.');
    panel.append(button('Back to vocabulary lessons','review-action vocab-wide',home));
    root.append(panel);
  }
  function startDue(){
    const due=dueVocabulary(currentWords(),state.vocabProgress).slice(0,VOCAB_BATCH_SIZE);
    if(due.length)beginQuiz(due,'due');
    else mode='empty-due';
  }
  function render(){
    if(view.hidden)return;
    root.replaceChildren();
    if(!dataset || !getCards().length){loadingView();return;}
    if(mode==='home')homeView();
    else if(mode==='learn')lessonView();
    else if(mode==='lesson-quiz'||mode==='due-quiz')questionView();
    else if(mode==='done')doneView();
    else {
      root.append(button('← Vocabulary Lab','review-small-button review-back',home));
      intro(root,'Your next spaced repetition is not due yet.');
      const panel=node('section','review-panel');
      addText(panel,'review-description','No words are due at the moment. Explore another 10-word lesson or return later.');
      panel.append(button('Explore lessons','review-action',home));
      root.append(panel);
    }
  }
  async function ensure(){
    if(dataset)return;
    if(!loading){
      loading=(async()=>{
        const responses=await Promise.all([
          fetch('data/hsk30/level-1.json'),fetch('data/hsk30/context.json')
        ]);
        if(responses.some(r=>!r.ok))throw new Error('Could not load HSK 3.0 vocabulary files.');
        const [vocab,examples]=await Promise.all(responses.map(r=>r.json()));
        validateVocabDataset(vocab);
        dataset=vocab;contexts=examples;error='';
      })().catch(e=>{loading=null;error=e.message||'Loading failed';throw e;});
    }
    return loading;
  }
  function route(){
    const match=/^#vocab(?:\/(lesson|review)\/(extended|all)(?:\/(\d{1,2}))?)?$/.exec(location.hash);
    if(!match){stopAudio();return;}
    const nextMode=match[1]||'home';
    const nextScope=match[2]||scope;
    const nextNumber=Number(match[3]||0);
    if((nextMode==='lesson'&&nextNumber<1)||
       (nextMode==='review'&&nextNumber!==0)){
      home();return;
    }
    const key=location.hash;
    if(key!==routeId){
      stopAudio();
      routeId=key;
      scope=nextScope;
      lessonNumber=nextNumber;
      studyIndex=0;
      sessionWords=[];sessionIndex=0;sessionCorrect=[];
      selected=null;shown=false;graded=false;
      mode=nextMode==='lesson'?'learn':nextMode==='review'?'due':'home';
    }
    if(dataset && getCards().length){
      if(mode==='due') startDue();
      render();
    }else{
      render();
      ensure().then(()=>{
        if(!view.hidden && mode==='due' && getCards().length)startDue();
        render();
      }).catch(()=>render());
    }
  }
  return {route,refresh(){if(!view.hidden)route();}};
}
