// Audio-first listening practice assembled from existing HSK 1 chapter sentence cards.
// No new flashcard IDs are created; no scheduler functions are called.
export const LISTENING_MODULES = Object.freeze([
  {id:'introductions',title:'People & Introductions',summary:'Greetings, names, family and age',chapters:[1,2,3,4,5]},
  {id:'time',title:'Time & Daily Routines',summary:'Dates, clocks, and everyday actions',chapters:[7,11,13]},
  {id:'places',title:'Places & Positions',summary:'Where people and objects are',chapters:[9,10]},
  {id:'food',title:'Food & Shopping',summary:'Drinks, prices, clothes and weather',chapters:[8,12,14]},
  {id:'activities',title:'Activities & Travel',summary:'Skills, studying, transport and journeys',chapters:[6,13,15]},
  {id:'mixed',title:'Mixed HSK 1',summary:'A varied review across all 15 chapters',chapters:Array.from({length:15},(_,i)=>i+1)}
]);
export const LISTENING_LEVELS = Object.freeze([
  {id:'easy',title:'Easy',difficulties:['easy']},
  {id:'everyday',title:'Everyday',difficulties:['easy','medium']},
  {id:'challenge',title:'Challenge',difficulties:['easy','medium','hard']}
]);
export const LISTENING_COUNT = 5;
export const LISTENING_STORAGE_KEY = 'mandarim-listening-v1';

export function listeningModule(id) {return LISTENING_MODULES.find(module=>module.id===id) || null;}
export function listeningLevel(id) {return LISTENING_LEVELS.find(level=>level.id===id) || null;}

export function listeningStats(data,moduleId) {
  const saved = data && typeof data==='object' && !Array.isArray(data) ? data[moduleId] : null;
  const n = value=>Number.isFinite(Number(value)) ? Math.max(0,Number(value)) : 0;
  return {attempts:n(saved?.attempts),best:n(saved?.best),latest:n(saved?.latest),
    correct:n(saved?.correct),answered:n(saved?.answered),
    recent:Array.isArray(saved?.recent)?saved.recent.filter(id=>typeof id==='string').slice(-20):[]};
}

// Assemble a balanced five-question set, avoiding recently heard sentences when possible.
// Distractors are distinct translations of *real* HSK sentence cards, not invented prompts.
export function buildListeningSession(cards,moduleId,levelId='everyday',stored={},count=LISTENING_COUNT) {
  const module=listeningModule(moduleId),level=listeningLevel(levelId);
  if(!module || !level) throw new Error('Unknown listening category or difficulty.');
  if(!Number.isInteger(count) || count<1 || count>10) throw new Error('Invalid session length.');
  const pool=(cards||[]).filter(c=>c?.type==='sentence' &&
    module.chapters.includes(Number((/^HSK 1 · Chapter (\d+)$/.exec(c.topic)||[])[1])) &&
    level.difficulties.includes(c.difficulty) && typeof c.zh==='string' && c.zh.trim() &&
    typeof c.py==='string' && c.py.trim() && typeof c.en==='string' && c.en.trim() &&
    Array.isArray(c.breakdown) && c.breakdown.length);
  const unique=[...new Map(pool.map(c=>[String(c.id),c])).values()];
  if(unique.length<count) throw new Error('Not enough listening sentences for this category.');
  const stats=listeningStats(stored,moduleId);
  const recent=new Set(stats.recent);
  const fresh=unique.filter(c=>!recent.has(String(c.id)));
  const eligible=fresh.length>=count?fresh:unique;
  const byChapter=new Map();
  for(const item of eligible){
    const chapter=Number((/^HSK 1 · Chapter (\d+)$/.exec(item.topic)||[])[1]);
    if(!byChapter.has(chapter)) byChapter.set(chapter,[]);
    byChapter.get(chapter).push(item);
  }
  const chapters=[...byChapter.keys()].sort((a,b)=>a-b);
  const rotate=(arr,n)=>arr.slice(n%arr.length).concat(arr.slice(0,n%arr.length));
  const orderedChapters=rotate(chapters,stats.attempts);
  const rounds=[];
  for(const n of orderedChapters) {
    const group=byChapter.get(n).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    byChapter.set(n,rotate(group,stats.attempts));
  }
  for(let round=0;round<count;round++){
    for(const n of orderedChapters){
      const group=byChapter.get(n);
      if(round<group.length) rounds.push(group[round]);
    }
  }
  const chosen=rounds.slice(0,count);
  const allAnswers=[...new Set(unique.map(c=>c.en))];
  if(allAnswers.length<3) throw new Error('Not enough distinct listening translations.');
  return chosen.map((card,index)=>{
    const alternatives=[...new Set(unique.filter(c=>String(c.id)!==String(card.id) && c.en!==card.en)
      .map(c=>c.en))];
    if(alternatives.length<2) throw new Error('Not enough answer alternatives.');
    const offset=(index+stats.attempts*2)%alternatives.length;
    const distractors=[alternatives[offset],alternatives[(offset+1)%alternatives.length]];
    const correctIndex=(index+stats.attempts)%3;
    const choices=distractors.slice();
    choices.splice(correctIndex,0,card.en);
    return {
      id:String(card.id),zh:card.zh,py:card.py,en:card.en,
      chapter:Number((/^HSK 1 · Chapter (\d+)$/.exec(card.topic)||[])[1]),
      breakdown:card.breakdown,choices,correctIndex
    };
  });
}

export function gradeListeningAnswer(question,index) {
  return Number.isInteger(index) && index===question?.correctIndex;
}

export function finishListeningSession(existing,moduleId,questions,answers,now=Date.now()) {
  if(!listeningModule(moduleId) || !Array.isArray(questions) || !questions.length ||
    !questions.every(q=>q?.id && Number.isInteger(q.correctIndex)) ||
    !Array.isArray(answers) || answers.length!==questions.length ||
    !answers.every(x=>x===null || Number.isInteger(x)))
    throw new Error('Invalid listening session results.');
  const stats=listeningStats(existing,moduleId);
  const correct=questions.filter((q,i)=>gradeListeningAnswer(q,answers[i])).length;
  const score=Math.round(correct/questions.length*100);
  return {
    ...existing,
    [moduleId]:{attempts:stats.attempts+1,best:Math.max(stats.best,score),latest:score,
      correct:stats.correct+correct,answered:stats.answered+questions.length,
      recent:[...stats.recent,...questions.map(q=>q.id)].slice(-20),lastCompletedAt:now}
  };
}
