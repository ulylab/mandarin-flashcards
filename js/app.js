import {state, saveHistory, saveStars, saveSettings, saveReview, exportProgress, importProgress, resetReviewHistory} from './storage.js';
import {nextCard, grade} from './scheduler.js';
const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
let cards = [], current = null, flipped = false, direction = 'zh', recent = [], session = 0;
let totalReviews = 0;
function options() {
  return {starredOnly: $('starredOnly').checked, topic: $('topic').value,
    direction: $('direction').value, pinyin: $('pinyin').checked,
    examples: $('examples').checked, mix: $('mix').value,
    sentencesEnabled: $('sentencesEnabled').checked};
}
function saveOptions() {state.settings = options(); saveSettings(); showStorageStatus();}
function restoreOptions() {
  const opts = state.settings;
  for (const id of ['topic','direction','mix']) {
    if (opts[id] && [...$(id).options].some(o => o.value === opts[id])) $(id).value = opts[id];
  }
  $('starredOnly').checked = opts.starredOnly === true;
  $('sentencesEnabled').checked = opts.sentencesEnabled !== false;
  $('pinyin').checked = opts.pinyin !== false;
  $('examples').checked = opts.examples !== false;
}
async function loadVocabulary() {
  const response = await fetch('data/manifest.json', {cache:'no-cache'});
  if (!response.ok) throw new Error(`Manifest unavailable (${response.status})`);
  const manifest = await response.json();
  if (!Array.isArray(manifest.packs) || !manifest.packs.length) throw new Error('No vocabulary packs configured');
  const loaded = await Promise.all(manifest.packs.map(async entry => {
    if (!/^data\/packs\/[a-z0-9-]+\.json$/.test(entry.file)) throw new Error('Invalid pack path');
    const res = await fetch(entry.file);
    if (!res.ok) throw new Error(`Could not load ${entry.file}`);
    const data = await res.json();
    if (!Array.isArray(data.cards)) throw new Error(`Invalid vocabulary pack: ${entry.file}`);
    return data.cards;
  }));
  const seen = new Set();
  const result = [];
  for (const pack of loaded) for (const card of pack) {
    const commonValid = card && (typeof card.id === 'number' || typeof card.id === 'string') &&
      card.zh && card.py && card.en && card.topic;
    const sentenceValid = card?.type === 'sentence' && ['easy','medium','hard'].includes(card.difficulty) &&
      typeof card.sourcePack === 'string' && Array.isArray(card.breakdown) && card.breakdown.length >= 1 &&
      card.breakdown.every(part => part && part.zh && part.py && part.en);
    const wordValid = card?.type !== 'sentence' && Array.isArray(card?.examples) &&
      card.examples.length === 2 && card.examples.every(ex => Array.isArray(ex) && ex.length === 3 && ex.every(Boolean));
    if (!commonValid || !(sentenceValid || wordValid))
      throw new Error(`Malformed card ${card?.id ?? '(missing ID)'} in vocabulary data`);
    const id = String(card.id);
    if (seen.has(id)) throw new Error(`Duplicate card ID: ${id}`);
    seen.add(id);
    result.push(card);
  }
  return result;
}
function showStorageStatus(message = '') { $('storageStatus').textContent = message || state.error || ''; }
function renderHistory() {
  const reviews = state.reviews;
  const practiced = Object.keys(state.history).filter(id => cards.some(c => String(c.id) === id)).length;
  const correct = reviews.filter(r => r.correct).length;
  totalReviews = reviews.length;
  $('stats').textContent = `${practiced} of ${cards.length} cards practiced · ${reviews.length} saved reviews`;
  $('historyDetails').textContent = reviews.length ? `${Math.round(correct / reviews.length * 100)}% correct across recorded reviews` : 'Your review history will appear here.';
  const list = $('recentReviews'); list.replaceChildren();
  for (const event of reviews.slice(-8).reverse()) {
    const c = cards.find(card => String(card.id) === event.id);
    const li = document.createElement('li');
    li.textContent = `${event.correct ? '✓' : '×'} ${c?.zh || `Card ${event.id}`} · ${new Date(event.at).toLocaleDateString()}`;
    list.appendChild(li);
  }
  showStorageStatus();
}
function pick() {
  const result = nextCard(cards, state.history, state.stars, options(), recent);
  current = result.card;
  recent = result.recent;
  direction = current?.type === 'sentence' ? 'zh' : ($('direction').value === 'mix' ? (Math.random() < 0.5 ? 'zh' : 'en') : $('direction').value);
  flipped = false;
  if (current) session++;
  render();
}
function render() {
  const c = current;
  $('total').textContent = cards.length + ' cards';
  $('card').classList.remove('sentence-card','sentence-easy','sentence-medium','sentence-hard','is-flipped');
  $('difficultyBadge').hidden = !c || c.type !== 'sentence';
  $('starCount').textContent = Object.values(state.stars).filter(Boolean).length + ' saved';
  $('star').hidden = !c;
  $('miss').disabled = !c; $('know').disabled = !c;
  if (!c) {
    $('topicLabel').textContent = '';
    $('difficultyBadge').textContent = '';
    $('content').innerHTML = '<div class="empty">No cards in this selection.<br><small>Change your filters in Settings.</small></div>';
    $('tip').textContent = '';
    $('progressText').textContent = 'No matching cards';
    $('reviewNote').textContent = 'Choose a different topic or turn off starred-only';
    renderHistory(); return;
  }
  $('star').textContent = state.stars[c.id] ? '★' : '☆';
  $('star').classList.toggle('active', Boolean(state.stars[c.id]));
  $('star').setAttribute('aria-pressed', state.stars[c.id] ? 'true' : 'false');
  $('star').setAttribute('aria-label', state.stars[c.id] ? 'Remove star' : 'Star this card');
  const isSentence = c.type === 'sentence';
  $('topicLabel').textContent = isSentence ? 'SENTENCE · ' + c.sourcePack.replace('extended-hsk1-', 'HSK 1 · ').replace('foundation-', 'Foundation · ') : c.topic;
  if (isSentence) {
    $('card').classList.add('sentence-card', 'sentence-' + c.difficulty);
    $('difficultyBadge').textContent = c.difficulty.toUpperCase();
  }
  if (flipped) $('card').classList.add('is-flipped');
  $('tip').textContent = flipped ? 'Tap to see front' : 'Tap to reveal';
  $('progressText').textContent = `Card ${session} · ${Object.keys(state.history).length} practiced`;
  const h = state.history[c.id];
  $('reviewNote').textContent = h ? (h.last === 'miss' ? 'This card needs review' : 'Previously answered correctly') : (isSentence ? 'New sentence' : 'New vocabulary');
  const wordClass = c.zh.length > 4 ? 'word phrase' : 'word';
  if (isSentence) {
    if (!flipped) {
      $('content').innerHTML = `<div class="sentence-zh" lang="zh-Hans">${escapeHTML(c.zh)}</div>${$('pinyin').checked ? `<div class="sentence-py">${escapeHTML(c.py)}</div>` : ''}`;
    } else {
      const parts = c.breakdown.map((piece,i) => `<div class="breakdown-row"><span class="breakdown-num">${i+1}</span><div class="breakdown-zh" lang="zh-Hans">${escapeHTML(piece.zh)}</div><div class="breakdown-py">${escapeHTML(piece.py)}</div><div class="breakdown-en">${escapeHTML(piece.en)}</div></div>`).join('');
      $('content').innerHTML = `<div class="sentence-answer-label">TRANSLATION</div><div class="sentence-translation">${escapeHTML(c.en)}</div><div class="sentence-answer-zh" lang="zh-Hans">${escapeHTML(c.zh)}</div><div class="sentence-answer-py">${escapeHTML(c.py)}</div><div class="sentence-answer-label breakdown-title">WORD-BY-WORD</div><div class="breakdown" aria-label="Word by word meaning">${parts}</div>`;
    }
    renderHistory();
    return;
  }
  if (!flipped) {
    $('content').innerHTML = direction === 'zh'
      ? `<div class="${wordClass}" lang="zh-Hans">${escapeHTML(c.zh)}</div>${$('pinyin').checked ? `<div class="roman">${escapeHTML(c.py)}</div>` : ''}`
      : `<div class="meaning">${escapeHTML(c.en)}</div>`;
  } else {
    const primary = direction === 'zh'
      ? `<div class="meaning">${escapeHTML(c.en)}</div><div class="answer-zh" lang="zh-Hans">${escapeHTML(c.zh)}</div>`
      : `<div class="answer-zh" lang="zh-Hans">${escapeHTML(c.zh)}</div><div class="meaning">${escapeHTML(c.en)}</div>`;
    const examples = $('examples').checked
      ? `<div class="examples">${c.examples.map((ex,i) => `<div class="example"><div class="example-label">EXAMPLE ${i + 1}</div><div class="cn" lang="zh-Hans">${escapeHTML(ex[0])}</div><div class="py">${escapeHTML(ex[1])}</div><div class="en">${escapeHTML(ex[2])}</div></div>`).join('')}</div>` : '';
    $('content').innerHTML = `${primary}<div class="answer-py">${escapeHTML(c.py)}</div>${examples}`;
  }
  renderHistory();
}
function flip() { if (current) { flipped = !flipped; render(); } }
function rate(correct) {
  if (!current) return;
  const id = String(current.id);
  state.history[id] = grade(state.history[id], correct);
  saveHistory(); saveReview(id, correct, state.history[id].due);
  pick();
}
function wireEvents() {
  for (const id of ['starredOnly','topic','direction','pinyin','examples','mix','sentencesEnabled']) {
    $(id).addEventListener('change', () => {
      saveOptions();
      if (['starredOnly','topic','direction','mix','sentencesEnabled'].includes(id)) pick(); else render();
    });
  }
  $('settingsBtn').onclick = () => {$('overlay').classList.add('open'); renderHistory();};
  $('close').onclick = () => $('overlay').classList.remove('open');
  $('overlay').onclick = e => {if(e.target === $('overlay')) $('overlay').classList.remove('open');};
  $('reset').onclick = () => {
    if (confirm('Reset all reviews and learning history on this device? Starred cards will be kept.')) {
      resetReviewHistory(); recent=[]; session=0; pick();
    }
  };
  $('star').addEventListener('pointerdown', e => e.stopPropagation());
  $('star').addEventListener('pointerup', e => e.stopPropagation());
  $('star').onclick = e => {
    e.stopPropagation(); if (!current) return;
    const id=String(current.id); state.stars[id]=!state.stars[id];saveStars();
    if ($('starredOnly').checked && !state.stars[id]) pick(); else render();
  };
  $('miss').onclick = () => rate(false);
  $('know').onclick = () => rate(true);
  $('card').onclick = flip;
  const card = $('card');let start=null, dragged=false;
  card.addEventListener('pointerdown',e=>{
    if (e.target === $('star') || e.button !== 0) return;
    start={x:e.clientX,y:e.clientY};dragged=false;
    card.classList.add('dragging');
  });
  card.addEventListener('pointermove',e=>{
    if(!start)return;
    const dx=e.clientX-start.x,dy=e.clientY-start.y;
    if(Math.abs(dx)>8 && Math.abs(dx)>Math.abs(dy)) card.style.transform=`translateX(${Math.max(-130,Math.min(130,dx))}px) rotate(${dx/28}deg)`;
  });
  card.addEventListener('pointerup',e=>{
    if(!start)return;
    const dx=e.clientX-start.x,dy=e.clientY-start.y;
    start=null;card.classList.remove('dragging');card.style.transform='';
    if(Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*1.2) {
      dragged=true;rate(dx>0);setTimeout(()=>{dragged=false},160);
    }
  });
  card.addEventListener('pointercancel',()=>{start=null;card.classList.remove('dragging');card.style.transform='';});
  card.addEventListener('click',e=>{if(dragged){e.stopImmediatePropagation();dragged=false;}},true);
  document.addEventListener('keydown',e=>{
    if ($('overlay').classList.contains('open')) {if(e.key==='Escape') $('overlay').classList.remove('open');return;}
    if(e.key==='ArrowLeft'){e.preventDefault();rate(false);}
    else if(e.key==='ArrowRight'){e.preventDefault();rate(true);}
    else if((e.code==='Space'||e.key==='Enter')&&(e.target===card||e.target===document.body)){e.preventDefault();flip();}
  });
  $('export').onclick = () => {
    const data = JSON.stringify(exportProgress(), null, 2);
    const url = URL.createObjectURL(new Blob([data],{type:'application/json'}));
    const a = document.createElement('a');a.href=url;a.download=`mandarin-progress-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
    showStorageStatus('Backup file created. Keep it somewhere safe.');
  };
  $('import').onclick = () => $('importFile').click();
  $('importFile').onchange = async e => {
    const file=e.target.files?.[0];if(!file)return;
    try {
      const data=JSON.parse(await file.text());
      if(!confirm('Replace the progress and stars on this device with the imported backup?'))return;
      importProgress(data);
      restoreOptions();recent=[];pick();showStorageStatus('Progress imported.');
    } catch (err) {showStorageStatus(err.message || 'Unable to import this backup.');}
    finally {e.target.value='';}
  };
}
async function start() {
  wireEvents();
  try {
    cards = await loadVocabulary();
    const topics = [...new Set(cards.map(c=>c.topic))].sort();
    $('topic').innerHTML = '<option value="all">All topics</option>' +
      topics.map(t=>`<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join('');
    restoreOptions(); pick();
    if ('serviceWorker' in navigator && location.protocol === 'https:')
      navigator.serviceWorker.register('sw.js').catch(()=>{});
  } catch (err) {
    $('progressText').textContent='Could not load vocabulary';
    $('content').innerHTML=`<div class="empty">${escapeHTML(err.message || 'Loading failed')}<br><small>Check your internet connection and refresh.</small></div>`;
    $('tip').textContent='';
    showStorageStatus('Vocabulary files are required for this version.');
  }
}
start();
