// HSK 3.0 Level 1 vocabulary learning: short exposure followed by active retrieval.
// Schedules are deliberately separate from existing flashcard progress and scheduler.
export const VOCAB_STORAGE_KEY = 'mandarim-hsk30-learning-v1';
export const VOCAB_BATCH_SIZE = 10;
export const INTERVALS_DAYS = Object.freeze([1,3,7,14,30,60,120]);
export const MISSED_DELAY_MS = 10*60*1000;

export const VOCAB_THEMES = Object.freeze([
  {title:'People & Relationships',words:'爸爸 妈妈 弟弟 哥哥 姐姐 妹妹 儿子 女儿 孩子 家人 人 男 女 男朋友 女朋友 女士 先生 朋友 你 你们 您 我 我们 他 她 它 他们 她们 它们 们 大家 同学'},
  {title:'Numbers & Quantities',words:'一 二 三 四 五 六 七 八 九 十 百 千 零 两 几 多少 多 少 个 本 件 块 元 分 分钟 小时 半 一半 一点儿 一些 一下 些 只 岁'},
  {title:'Time & Calendar',words:'白天 今天 明天 昨天 今年 明年 去年 年 月 日 号 天 星期 星期日 星期天 现在 早 早上 上午 中午 下午 晚 晚上 时候 时间 点 早饭 午饭 晚饭'},
  {title:'Food & Drinks',words:'菜 茶 吃 饭 米饭 面包 面条儿 包子 饺子 喝 牛奶 水 水果 苹果 鸡蛋 好吃 做饭 饭店'},
  {title:'Places & Travel',words:'中国 国 家 学校 大学 小学 中学 房间 公司 超市 商店 书店 电影院 医院 店 里 外 外边 上 下 前 后 边 那边 这边 那里 这里 那儿 这儿 哪儿 哪里 车 出租车 火车 飞机 开车 开 到 来 去 回 住 坐'},
  {title:'School & Work',words:'汉语 汉字 中文 字 书 读 读书 电脑 电视 电影 手机 电话 打电话 老师 学 学习 学生 小学生 中学生 大学生 上学 上课 下课 课 工作 上班 下班 做 写 问 问题 认识 知道'},
  {title:'Actions & Routines',words:'买 卖 穿 玩 唱 歌 睡 睡觉 起床 看 看见 看病 听 听见 说 说话 找 给 想 要 会 能 可以 休息 下雨 正在 见'},
  {title:'Descriptions & Feelings',words:'好 很 大 小 新 贵 便宜 漂亮 高兴 冷 热 忙 天气 雪 雨 爱 喜欢 好玩儿 好看 好听 真 非常 太 对'},
  {title:'Questions & Core Grammar',words:'什么 谁 哪 哪个 哪些 哪个 哪些 那 那个 那些 这 这个 这些 怎么 怎么样 吧 呢 吗 是 不 不要 没有 了 的 都 和 也 在 再 有 有的 有点儿 有些 还 第 请 请问 谢谢 你好 不客气 对不起 没关系 没事 再见 喂'}
]);

const toIds = words => new Set(words.split(/\s+/).filter(Boolean));
export function orderVocabulary(words) {
  if(!Array.isArray(words)) throw new Error('Missing vocabulary words');
  const seen=new Set(),result=[];
  for(const theme of VOCAB_THEMES){
    const entries=toIds(theme.words);
    for(const word of words){
      if(entries.has(word.zh)&&!seen.has(word.id)){
        result.push({...word,theme:theme.title}); seen.add(word.id);
      }
    }
  }
  for(const word of words){
    if(!seen.has(word.id)){result.push({...word,theme:'Essential Expressions'});seen.add(word.id);}
  }
  return result;
}
export function selectVocabScope(words,bookWords,scope='extended'){
  const known=new Set((bookWords||[]).filter(c=>c.topic==='HSK Book 1 vocabulary').map(c=>c.zh));
  return scope==='extended' ? words.filter(w=>!known.has(w.zh)) : words;
}
export function vocabularyLessons(words,bookWords,scope='extended'){
  const items=orderVocabulary(selectVocabScope(words,bookWords,scope));
  return Array.from({length:Math.ceil(items.length/VOCAB_BATCH_SIZE)},(_,i)=>{
    const batch=items.slice(i*VOCAB_BATCH_SIZE,(i+1)*VOCAB_BATCH_SIZE);
    const groups=[...new Set(batch.map(w=>w.theme))];
    return {id:scope+'-'+String(i+1).padStart(2,'0'),number:i+1,
      title:groups.length===1?groups[0]:groups[0]+' & more',words:batch};
  });
}
const safeRecord=value=>{
  const v=value && typeof value==='object'&&!Array.isArray(value)?value:{};
  const finite=n=>Number.isFinite(Number(n))&&Number(n)>0?Number(n):0;
  return {seen:finite(v.seen),correct:finite(v.correct),streak:finite(v.streak),
    due:finite(v.due),last:finite(v.last),lastCorrect:v.lastCorrect===true};
};
export function vocabularyRecord(progress,id) {
  return safeRecord(progress?.records?.[id]);
}
export function dueVocabulary(words,progress,now=Date.now()){
  return words.filter(w=>{
    const rec=vocabularyRecord(progress,w.id);
    return rec.seen>0&&rec.due<=now;
  }).sort((a,b)=>vocabularyRecord(progress,a.id).due-vocabularyRecord(progress,b.id).due);
}
export function vocabularyProgress(progress,words,now=Date.now()){
  const seen=words.filter(w=>vocabularyRecord(progress,w.id).seen>0);
  const due=dueVocabulary(words,progress,now);
  const strong=seen.filter(w=>vocabularyRecord(progress,w.id).streak>=3);
  return {total:words.length,started:seen.length,due:due.length,strong:strong.length};
}
export function gradeVocabulary(progress,wordId,correct,now=Date.now()){
  if(!wordId||typeof wordId!=='string')throw new Error('Missing word ID');
  const base=progress&&typeof progress==='object'&&!Array.isArray(progress)?progress:{};
  const old=vocabularyRecord(base,wordId);
  const streak=correct?old.streak+1:0;
  const days=correct?INTERVALS_DAYS[Math.min(streak-1,INTERVALS_DAYS.length-1)]:0;
  const rec={seen:old.seen+1,correct:old.correct+(correct?1:0),streak,
    last:now,due:correct?now+days*86400000:now+MISSED_DELAY_MS,
    lastCorrect:Boolean(correct)};
  return {...base,records:{...(base.records||{}),[wordId]:rec}};
}
const mainMeaning=en=>String(en).split(';')[0].trim();
export function vocabularyQuestion(word,pool,attempt=0){
  if(!word||!Array.isArray(pool))throw new Error('Invalid question pool');
  const available=pool.filter(x=>x.id!==word.id && mainMeaning(x.en)!==mainMeaning(word.en));
  const same=available.filter(x=>x.pos===word.pos);
  const choices=[...same,...available.filter(x=>!same.includes(x))]
    .filter((v,i,a)=>a.findIndex(x=>mainMeaning(x.en)===mainMeaning(v.en))===i);
  if(choices.length<3)throw new Error('Insufficient distinct vocabulary distractors.');
  const offset=(word.seq+attempt)%choices.length;
  const distractors=Array.from({length:3},(_,i)=>choices[(offset+i)%choices.length]);
  const correctIndex=(word.seq+attempt)%4;
  const items=distractors.map(x=>({id:x.id,text:mainMeaning(x.en)}));
  items.splice(correctIndex,0,{id:word.id,text:mainMeaning(word.en)});
  return {wordId:word.id,kind:'choice',prompt:word.zh,options:items,correctIndex};
}
export function validateVocabDataset(dataset){
  if(!dataset||dataset.level!==1||dataset.count!==300||dataset.words?.length!==300)
    throw new Error('Incomplete HSK 3.0 Level 1 vocabulary.');
  const ids=new Set(),zh=new Set();
  for(const w of dataset.words){
    if(!w.id||ids.has(w.id)||!w.zh||!w.py||!w.en||!Number.isInteger(w.seq)||
      w.seq<1||w.seq>300)throw new Error('Malformed or duplicate HSK 3.0 word.');
    ids.add(w.id); zh.add(w.zh);
  }
  if(ids.size!==300 ||zh.size!==300)throw new Error('Duplicate HSK 3.0 word.');
  return true;
}
