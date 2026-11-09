import {state,saveDailyProgress} from './storage.js';

const stages=[
  {name:'Vocabulary recall',minutes:6,kind:'vocab',count:8},
  {name:'Listening comprehension',minutes:8,kind:'listening',count:6},
  {name:'Reading comprehension',minutes:7,kind:'reading',count:6},
  {name:'Sentence patterns',minutes:6,kind:'grammar',count:5},
  {name:'Mistake review',minutes:3,kind:'review',count:0}
];
const make=(tag,cls='',text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
const btn=(label,fn,cls='review-action')=>{const n=make('button',cls,label);n.type='button';n.addEventListener('click',fn);return n;};
const localDay=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const daySeed=day=>[...day].reduce((a,c)=>((a*33+c.charCodeAt(0))>>>0),5381);
const sample=(list,seed,index)=>list.length?list[(seed+index*13)%list.length]:null;
const uniqueOptions=(correct,pool,seed)=> {
  const entries=[correct];
  for(let i=0;i<pool.length&&entries.length<4;i++){const candidate=pool[(seed+i*17)%pool.length];if(candidate && !entries.includes(candidate))entries.push(candidate);}
  const pivot=seed%entries.length;
  return [...entries.slice(pivot),...entries.slice(0,pivot)];
};
export function buildDailyQuestions(words,cards,day){
  const seed=daySeed(day);
  const dictionary=words.filter(w=>w.zh&&w.en&&w.py);
  const sentences=cards.filter(c=>c.type==='sentence'&&c.zh&&c.en&&Array.isArray(c.breakdown)&&c.breakdown.length>=2);
  const wordsEn=[...new Set(dictionary.map(w=>w.en))];
  const sentencesEn=[...new Set(sentences.map(c=>c.en))];
  if(dictionary.length<30||sentences.length<25)throw new Error('The vocabulary and sentence banks are still loading.');
  const out=[];
  for(let stage=0;stage<4;stage++) for(let i=0;i<stages[stage].count;i++){
    const id=stage+'-'+i;
    if(stage===0){
      const w=sample(dictionary,seed+stage*37,i+1);
      out.push({id,stage,prompt:w.zh,zh:w.zh,py:w.py,translation:w.en,
        question:'Choose the correct meaning',options:uniqueOptions(w.en,wordsEn,seed+i*67),answer:w.en,explain:w.zh+' · '+w.py+' · '+w.en});
    }else{
      const c=sample(sentences,seed+stage*43,i+1);
      if(stage===3){
        const tokens=c.breakdown.map(p=>p.zh).filter(Boolean);
        const options=uniqueOptions(c.zh,sentences.map(s=>s.zh),seed+i*67);
        out.push({id,stage,prompt:tokens.join(' / '),zh:c.zh,py:c.py,translation:c.en,
          question:'Which correctly ordered sentence matches these words?',options,answer:c.zh,explain:c.zh+' · '+c.py+' · '+c.en});
      }else{
        out.push({id,stage,prompt:c.zh,zh:c.zh,py:c.py,translation:c.en,
          question:stage===1?'Listen, then choose the meaning':'Read the sentence and choose its meaning',
          options:uniqueOptions(c.en,sentencesEn,seed+stage*31+i*67),answer:c.en,
          explain:c.zh+' · '+c.py+' · '+c.en});
      }
    }
  }
  return out;
}
export function initDailyPrep({getCards,playAudio,stopAudio,canPlayAudio}){
 const root=document.getElementById('dailyRoot'),view=document.getElementById('dailyView');
 if(!root||!view)return {route(){},refresh(){}};
 let words=null,loading=null,error='',lastRoute='';
 const day=()=>localDay();
 const record=()=>state.dailyProgress[day()]||null;
 const setRecord=rec=>{state.dailyProgress={...state.dailyProgress,[day()]:rec};saveDailyProgress();};
 const seconds=rec=>Math.max(0,Math.floor((Date.now()-rec.startedAt)/1000));
 const allQuestions=()=>buildDailyQuestions(words||[],getCards(),day());
 const status=(parent,text)=>{const p=make('p','review-description',text);parent.append(p);return p;};
 function load(){
   if(words||loading)return loading||Promise.resolve();
   loading=fetch('data/hsk30/level-1.json').then(r=>{if(!r.ok)throw Error('Cannot load HSK 3.0 vocabulary');return r.json();})
    .then(d=>{if(!Array.isArray(d.words)||d.words.length!==300)throw Error('Invalid HSK 3.0 syllabus');words=d.words;error='';})
    .catch(e=>{error=e.message;}).finally(()=>{loading=null;render();});
   return loading;
 }
 const heading=(parent,kicker,title)=>{parent.append(make('p','review-kicker',kicker),make('h2','review-title',title));};
 function overview(){
   const panel=make('div','review-home-intro');
   panel.append(make('p','review-kicker','HSK 3.0 · LEVEL 1'),make('h1','','Daily Exam Prep'));
   const remaining=Math.max(0,Math.ceil((new Date(2026,11,13)-new Date())/86400000));
   status(panel,remaining+' days to December 13, 2026 · 30-minute daily training');
   root.append(panel);
   const info=make('section','review-panel');
   const rec=record(),answered=rec?Object.keys(rec.answers||{}).length:0;
   info.append(make('h3','',rec?.completedAt?'Today’s session completed':rec?'Continue today’s session':'Today’s plan'));
   status(info,rec?.completedAt?'You can review today’s answers or practise again tomorrow.':answered+' of 25 questions answered. Exercises rotate daily using the current HSK 3.0 Level 1 word list and your existing sentence bank.');
   for(const s of stages)info.append(make('p','daily-plan-row',s.name+' · '+s.minutes+' minutes'));
   if(error)status(info,error);
   const start=btn(rec?.completedAt?'Review results':rec?'Resume session':'Start 30-minute session',()=>{
     if(!record())setRecord({startedAt:Date.now(),answers:{},completedAt:null});
     location.hash='daily/session';render();
   });
   start.disabled=!words||getCards().length===0;
   info.append(start);
   root.append(info);
   status(root,'The 30 minutes are a paced study target, not an official timed mock exam. Listening uses your device’s Mandarin voice. Sentence questions are based on the existing HSK 1 book, and do not claim to reproduce official HSK 3.0 exam items.');
 }
 function session(){
   const rec=record();
   if(!rec){location.hash='daily';return;}
   const questions=allQuestions(),answers=rec.answers||{},index=questions.findIndex(q=>!answers[q.id]);
   root.append(btn('← Daily plan',()=>{stopAudio();location.hash='daily';},'review-small-button review-back'));
   if(index===-1){
     const panel=make('section','review-panel');
     heading(panel,'TODAY’S RESULTS','Your 30-minute practice');
     const score=questions.filter(q=>answers[q.id]?.correct).length;
     panel.append(make('p','review-score',score+' / '+questions.length+' correct'));
     status(panel,'Time since starting: '+Math.floor(seconds(rec)/60)+' minutes. Results and missed answers are saved in this browser.');
     if(!rec.completedAt)setRecord({...rec,completedAt:Date.now()});
     const mistakes=questions.filter(q=>!answers[q.id]?.correct);
     panel.append(make('h3','',mistakes.length?'Review your missed answers':'All answers correct'));
     for(const q of mistakes){
       const item=make('div','review-mistake');
       item.append(make('p','',q.zh+' · '+q.py),make('p','',q.translation));
       item.append(btn('▶ Listen',()=>playAudio(q.zh,0.8),'review-small-button'));
       panel.append(item);
     }
     panel.append(btn('Back to plan',()=>{location.hash='daily';}));
     root.append(panel);return;
   }
   const q=questions[index],stage=stages[q.stage],count=questions.filter(x=>x.stage===q.stage).length;
   const stageIndex=questions.slice(0,index).filter(x=>x.stage===q.stage).length+1;
   const panel=make('section','review-panel daily-question');
   heading(panel,'SECTION '+(q.stage+1)+' OF 5 · '+stage.minutes+' MIN',''+stage.name);
   status(panel,'Question '+stageIndex+' / '+count+' · Overall '+(index+1)+' / '+questions.length);
   const timing=make('p','review-note','Session timer: '+Math.floor(seconds(rec)/60)+' minutes elapsed');
   panel.append(timing);
   if(q.stage===1){
     panel.append(make('p','review-description','Chinese text is hidden until you answer. Listen before choosing.'));
     const play=btn('▶ Listen to question',()=>playAudio(q.zh,0.85),'review-action secondary');
     const slow=btn('▶ Slower',()=>playAudio(q.zh,0.65),'review-small-button');
     play.disabled=slow.disabled=!canPlayAudio;
     panel.append(play,slow);
   }else {
     const chinese=make('div','review-zh',q.prompt);chinese.lang='zh-Hans';panel.append(chinese);
   }
   panel.append(make('p','review-question-heading',q.question));
   const choices=make('div','review-answer-inputs');
   for(const option of q.options){
     choices.append(btn(option,()=>{
       stopAudio();
       const correct=option===q.answer;
       setRecord({...record(),answers:{...record().answers,[q.id]:{correct,chosen:option}}});
       choices.querySelectorAll('button').forEach(b=>b.disabled=true);
       const feedback=make('div','review-feedback '+(correct?'is-correct':'is-incorrect'));
       feedback.append(make('strong','',correct?'Correct':'Not quite'));
       status(feedback,'Answer: '+q.answer);
       status(feedback,q.explain);
       panel.append(feedback,btn('Next →',render));
     },'review-choice'));
   }
   panel.append(choices);root.append(panel);
 }
 function render(){
   if(view.hidden)return;
   root.replaceChildren();
   if(!words){overview();load();return;}
   if(location.hash==='#daily/session')session();else overview();
 }
 function route(){
   if(!/^#daily(?:\/session)?$/.test(location.hash)){stopAudio();return;}
   if(lastRoute!==location.hash){lastRoute=location.hash;stopAudio();}
   render();
 }
 return {route,refresh(){if(!view.hidden)render();}};
}
