import {state, saveLessonProgress} from './storage.js';
import {initListening} from './listening.js';
import {initVocabularyLab} from './vocab-lab.js';
import {initDailyPrep} from './daily-prep.js';
import {REVIEW_CHAPTERS, buildChapterReviewLesson, validateLessonCatalog} from './review-curriculum.js';
import {REVIEW_SCREENS, checkReviewAnswer, validateReviewLesson, chapterState,
  recordVisited, recordPractice, recordChallenge} from './review-model.js';

const el = (tag, className = '', text = null) => {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== null) item.textContent = text;
  return item;
};
const button = (text, className, action) => {
  const item = el('button', className, text);
  item.type = 'button';
  item.addEventListener('click', action);
  return item;
};
const paragraph = (parent, className, text) => {
  parent.append(el('p', className, text));
};
const answerLabel = question => question.kind === 'choice'
  ? question.options[question.answer]
  : question.kind === 'order' ? question.answer.join(' ') : question.answers[0];

export function initReview({getCards, playAudio, stopAudio, canPlayAudio}) {
  const flashcards = document.getElementById('flashcardsView');
  const review = document.getElementById('reviewView');
  const listeningView = document.getElementById('listeningView');
  const vocabView = document.getElementById('vocabView');
  const dailyView = document.getElementById('dailyView');
  const root = document.getElementById('reviewRoot');
  const cardTab = document.getElementById('cardsTab');
  const reviewTab = document.getElementById('reviewTab');
  const dailyTab = document.getElementById('dailyTab');
  if (!flashcards || !review || !listeningView || !vocabView || !dailyView || !root || !cardTab || !reviewTab || !dailyTab) return {refresh() {}};
  const listeningUI = initListening({getCards,playAudio,stopAudio,canPlayAudio});
  const vocabUI = initVocabularyLab({getCards,playAudio,stopAudio,canPlayAudio});
  const dailyUI = initDailyPrep({getCards,playAudio,stopAudio,canPlayAudio});

  let lesson = null;
  let loading = null;
  let catalog = null;
  let catalogLoading = null;
  let selectedChapter = null;
  let showChapterList = false;
  let loadError = '';
  let screen = 0;
  let showPinyin = true;
  let showEnglish = true;
  let practiceIndex = 0;
  let practiceResults = {};
  let practiceFinished = false;
  let challengeIndex = 0;
  let challengeResults = {};
  let challengeFinished = false;

  const chapterKey = number => 'chapter-' + String(number).padStart(2, '0');
  const chapter = () => chapterState(state.lessonProgress, chapterKey(selectedChapter || 11));
  const save = value => {
    state.lessonProgress = {...state.lessonProgress, [chapterKey(selectedChapter || 11)]: value};
    saveLessonProgress();
  };
  function markVisited(value) {
    const current = chapter();
    if (!current.visited.includes(value)) save(recordVisited(current, value));
  }
  function speak(zh) { playAudio(zh); }
  function lineCard(zh, py, en, extraClass = '') {
    const item = el('div', 'review-line ' + extraClass);
    const top = el('div', 'review-line-top');
    const cn = el('div', 'review-zh', zh);
    cn.lang = 'zh-Hans';
    top.append(cn, button('▶ Listen', 'review-listen', () => speak(zh.replace(/^[AB]：/, ''))));
    item.append(top);
    if (showPinyin) item.append(el('div', 'review-pinyin', py));
    if (showEnglish) item.append(el('div', 'review-english', en));
    return item;
  }
  function heading(parent, kicker, title, intro = '') {
    parent.append(el('p', 'review-kicker', kicker), el('h2', 'review-title', title));
    if (intro) paragraph(parent, 'review-description', intro);
  }
  function toggles(parent) {
    const bar = el('div', 'review-toggles');
    const py = button(showPinyin ? 'Hide pinyin' : 'Show pinyin', 'review-small-button', () => {
      showPinyin = !showPinyin; render();
    });
    const en = button(showEnglish ? 'Hide English' : 'Show English', 'review-small-button', () => {
      showEnglish = !showEnglish; render();
    });
    py.setAttribute('aria-pressed', String(showPinyin));
    en.setAttribute('aria-pressed', String(showEnglish));
    bar.append(py,en);
    parent.append(bar);
  }
  function vocabulary(container) {
    heading(container, 'SCREEN 1 · DISCOVER', 'Vocabulary & pronunciation',
      'Study the words from your existing chapter flashcard bank, then practice supporting expressions.');
    toggles(container);
    const book = getCards().filter(card => card.topic === 'HSK Book 1 vocabulary' && card.lesson === lesson.number);
    const bookPanel = el('section', 'review-panel');
    bookPanel.append(el('h3', '', 'From your HSK Book 1 · Chapter ' + lesson.number + ' bank'));
    if (!book.length) paragraph(bookPanel, 'review-description', 'Vocabulary is loading. The supporting expressions below are available now.');
    for (const word of book) bookPanel.append(lineCard(word.zh, word.py, word.en));
    container.append(bookPanel);
    const extra = el('section', 'review-panel');
    extra.append(el('h3', '', 'Supporting expressions'));
    paragraph(extra, 'review-note', 'Useful expressions from the examples. Some extend beyond the assigned chapter vocabulary.');
    for (const word of lesson.supportingWords) extra.append(lineCard(word.zh, word.py, word.en));
    container.append(extra);
  }
  function concepts(container) {
    heading(container, 'SCREEN 2 · UNDERSTAND', 'Grammar & sentence patterns',
      'Read the pattern, compare examples, then say the sentences aloud.');
    toggles(container);
    for (const [index, concept] of lesson.concepts.entries()) {
      const panel = el('section', 'review-panel');
      panel.append(el('p', 'review-section-label', 'PATTERN ' + (index + 1)));
      panel.append(el('h3', '', concept.heading));
      paragraph(panel, 'review-description', concept.rule);
      panel.append(el('div', 'review-formula', concept.formula));
      for (const sample of concept.examples) panel.append(lineCard(...sample));
      container.append(panel);
    }
    if (lesson.number === 11) {
      const note = el('aside', 'review-tip');
      note.append(el('strong', '', 'Tone check'));
      paragraph(note, '', '工作 gōngzuò (1st + 4th); 下午 xiàwǔ (4th + 3rd); 然后 ránhòu (2nd + 4th); 睡觉 shuìjiào (4th + 4th).');
      container.append(note);
    }
  }
  function examples(container) {
    heading(container, 'SCREEN 3 · READ & LISTEN', 'Examples, stories & dialogues',
      'Follow the full sentence, then hide pinyin or English and read it again.');
    toggles(container);
    for (const [index, story] of lesson.stories.entries()) {
      const panel = el('section', 'review-panel');
      panel.append(el('p', 'review-section-label', 'EXAMPLE ' + (index + 1)));
      panel.append(el('h3', '', story.title));
      if (showPinyin && story.py) paragraph(panel, 'review-pinyin', story.py);
      if (showEnglish && story.en) paragraph(panel, 'review-english', story.en);
      for (const sample of story.lines) panel.append(lineCard(...sample));
      panel.append(button('▶ Listen to all examples', 'review-action secondary', () =>
        speak(story.lines.map(line => line[0].replace(/^[AB]：/, '')).join(' '))));
      container.append(panel);
    }
  }
  function questionCard(question, onResult, onContinue, continueLabel) {
    const panel = el('section', 'review-panel review-question');
    panel.append(el('p', 'review-section-label', question.kind === 'choice' ? 'CHOOSE ONE' :
      question.kind === 'order' ? 'BUILD THE SENTENCE' : 'TYPE THE PINYIN'));
    panel.append(el('h3', 'review-question-heading', question.question));
    if (question.hint) paragraph(panel, 'review-note', 'Hint: ' + question.hint);
    let value = null;
    const inputs = el('div', 'review-answer-inputs');
    const submit = button('Check answer', 'review-action', () => {
      const correct = checkReviewAnswer(question, value);
      submit.remove();
      inputs.querySelectorAll('button,input').forEach(control => control.disabled = true);
      const feedback = el('div', 'review-feedback ' + (correct ? 'is-correct' : 'is-incorrect'));
      feedback.setAttribute('role','status');
      feedback.append(el('strong', '', correct ? 'Correct' : 'Not quite'));
      if (!correct) paragraph(feedback, '', 'Correct answer: ' + answerLabel(question));
      paragraph(feedback, '', question.why);
      panel.append(feedback);
      onResult(correct);
      panel.append(button(continueLabel, 'review-action', onContinue));
    });
    submit.disabled = true;
    if (question.kind === 'choice') {
      question.options.forEach((option, index) => {
        const choice = button(String.fromCharCode(65 + index) + '. ' + option, 'review-choice', () => {
          value = index;
          inputs.querySelectorAll('button').forEach(item => {
            item.classList.remove('is-selected');
            item.setAttribute('aria-pressed','false');
          });
          choice.classList.add('is-selected');
          choice.setAttribute('aria-pressed','true');
          submit.disabled = false;
        });
        choice.setAttribute('aria-pressed','false');
        inputs.append(choice);
      });
    } else if (question.kind === 'input') {
      const input = el('input', 'review-text-input');
      input.type = 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = 'Type pinyin here';
      input.setAttribute('aria-label', 'Type the answer in pinyin');
      input.addEventListener('input', () => {value = input.value; submit.disabled = !input.value.trim();});
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !submit.disabled) {e.preventDefault(); submit.click();}
      });
      inputs.append(input);
      paragraph(inputs, 'review-note', 'Tone marks are optional. Spaces and punctuation are ignored.');
    } else {
      let order = [];
      const chosen = el('div', 'review-chosen', 'Tap words below to build your answer');
      const tokens = el('div', 'review-word-bank');
      const reset = button('Clear', 'review-small-button', () => {order=[]; refreshTokens();});
      function refreshTokens() {
        chosen.textContent = order.length ? order.join(' ') : 'Tap words below to build your answer';
        tokens.replaceChildren();
        question.tokens.forEach((token, index) => {
          const used = order.some(entry => entry.index === index);
          const item = button(token, 'review-word' + (used ? ' is-used' : ''), () => {
            order.push({index, token});
            refreshTokens();
          });
          item.disabled = used;
          tokens.append(item);
        });
        chosen.textContent = order.length ? order.map(entry => entry.token).join(' ') : 'Tap words below to build your answer';
        value = order.map(entry => entry.token);
        submit.disabled = order.length !== question.tokens.length;
      }
      inputs.append(chosen, tokens, reset);
      refreshTokens();
    }
    panel.append(inputs, submit);
    return panel;
  }
  function practice(container) {
    heading(container, 'SCREEN 4 · PRACTICE', 'Guided exercises',
      'Eight questions with instant explanations. Mistakes are safe to retry; this will not change flashcard scheduling.');
    const saved = chapter().practice;
    const correctCount = Object.values(saved).filter(rec => rec.correct === true).length;
    paragraph(container, 'review-note', 'Previously answered correctly: ' + correctCount + ' of ' + lesson.practice.length);
    if (practiceFinished) {
      const panel = el('section', 'review-panel');
      panel.append(el('h3', '', 'Practice complete'));
      paragraph(panel, 'review-description', 'This run: ' + Object.values(practiceResults).filter(Boolean).length +
        '/' + lesson.practice.length + ' correct. Revisit any exercise whenever you like.');
      panel.append(button('Practice again', 'review-action', () => {
        practiceIndex = 0; practiceResults = {}; practiceFinished = false; render();
      }));
      container.append(panel);
      return;
    }
    paragraph(container, 'review-counter', 'QUESTION ' + (practiceIndex + 1) + ' OF ' + lesson.practice.length);
    const q = lesson.practice[practiceIndex];
    container.append(questionCard(q, correct => {
      practiceResults[q.id] = correct;
      save(recordPractice(chapter(), q.id, correct));
    }, () => {
      practiceIndex += 1;
      if (practiceIndex >= lesson.practice.length) practiceFinished = true;
      render();
    }, practiceIndex === lesson.practice.length - 1 ? 'See practice summary' : 'Next question'));
  }
  function challenge(container) {
    heading(container, 'SCREEN 5 · TEST YOURSELF', 'Chapter ' + lesson.number + ' challenge',
      'Ten mixed questions. Aim for 80% or above. Your highest and latest scores are saved separately from flashcards.');
    const saved = chapter();
    paragraph(container, 'review-note', 'Best score: ' + (saved.attempts ? saved.bestScore + '%' : 'Not attempted') +
      ' · Attempts: ' + saved.attempts);
    if (challengeFinished) {
      const panel = el('section', 'review-panel');
      const correct = Object.values(challengeResults).filter(Boolean).length;
      panel.append(el('p','review-section-label','RESULTS'));
      panel.append(el('h3','review-score',correct + ' / ' + lesson.challenge.length + ' correct'));
      paragraph(panel,'review-description',Math.round(100 * correct / lesson.challenge.length) >= 80
        ? 'Target met. Well done — keep revisiting any missed questions.'
        : 'Review the missed answers below, then retry to improve your score.');
      const missed = lesson.challenge.filter(q => challengeResults[q.id] === false);
      if (missed.length) {
        panel.append(el('h4','', 'Review missed questions'));
        for (const q of missed) {
          const entry = el('div','review-mistake');
          entry.append(el('strong','',q.question));
          paragraph(entry,'','Answer: '+answerLabel(q));
          paragraph(entry,'review-note',q.why);
          panel.append(entry);
        }
      }
      panel.append(button('Try the challenge again', 'review-action', () => {
        challengeIndex = 0; challengeResults = {}; challengeFinished = false; render();
      }));
      container.append(panel);
      return;
    }
    paragraph(container,'review-counter','QUESTION ' + (challengeIndex + 1) + ' OF ' + lesson.challenge.length);
    const q = lesson.challenge[challengeIndex];
    container.append(questionCard(q, correct => {
      challengeResults[q.id] = correct;
    }, () => {
      challengeIndex += 1;
      if (challengeIndex >= lesson.challenge.length) {
        challengeFinished = true;
        const correct = Object.values(challengeResults).filter(Boolean).length;
        save(recordChallenge(chapter(), correct, lesson.challenge.length));
      }
      render();
    }, challengeIndex === lesson.challenge.length - 1 ? 'See my score' : 'Next question'));
  }

  function resetChapterSession() {
    lesson = null;
    loading = null;
    screen = 0;
    practiceIndex = 0;
    practiceResults = {};
    practiceFinished = false;
    challengeIndex = 0;
    challengeResults = {};
    challengeFinished = false;
    loadError = '';
  }
  function openChapter(number) {
    if (!Number.isInteger(number) || number < 1 || number > 15) return;
    location.hash = 'review/' + number;
  }
  function practiceHome() {
    const intro=el('div','review-home-intro');
    intro.append(el('p','review-kicker','HSK 1 · STUDY & PRACTICE'));
    intro.append(el('h1','','Practice'));
    paragraph(intro,'','Choose a focused activity: structured chapter lessons, five-question listening sessions, or guided HSK 3.0 vocabulary learning.');
    root.append(intro);
    const grid=el('div','review-chapter-grid');
    const chapter=button('','review-chapter-card',()=>{location.hash='review/chapters';});
    chapter.append(el('span','review-chapter-num','LESSONS'));
    chapter.append(el('span','review-chapter-name','Chapter Review'));
    chapter.append(el('span','listen-module-summary','Vocabulary, grammar, examples, and challenges'));
    chapter.append(el('span','review-chapter-meta','15 HSK 1 chapters'));
    grid.append(chapter);
    const listening=button('','review-chapter-card',()=>{location.hash='listen';});
    listening.append(el('span','review-chapter-num','AUDIO FIRST'));
    listening.append(el('span','review-chapter-name','Listening Trainer'));
    listening.append(el('span','listen-module-summary','Hear Mandarin and choose the correct meaning'));
    listening.append(el('span','review-chapter-meta','5 questions · 6 topics'));
    grid.append(listening);
    const vocab=button('','review-chapter-card',()=>{location.hash='vocab';});
    vocab.append(el('span','review-chapter-num','HSK 3.0 · 2025 SYLLABUS'));
    vocab.append(el('span','review-chapter-name','Vocabulary Lab'));
    vocab.append(el('span','listen-module-summary','10-word lessons, active recall and spaced review'));
    vocab.append(el('span','review-chapter-meta','300 Level 1 entries'));
    grid.append(vocab);
    const daily=button('','review-chapter-card',()=>{location.hash='daily';});
    daily.append(el('span','review-chapter-num','DECEMBER 13 · HSK 3.0'),el('span','review-chapter-name','Daily Exam Prep'),el('span','listen-module-summary','Vocabulary, listening, reading, sentence building, and corrections'),el('span','review-chapter-meta','30 minutes · New session daily'));
    grid.prepend(daily);
    root.append(grid);
  }
  function dashboard() {
    root.append(button('← Practice','review-small-button review-back',()=>{location.hash='review';}));
    const intro = el('div', 'review-home-intro');
    intro.append(el('p','review-kicker','HSK STANDARD COURSE 1'));
    intro.append(el('h1','', 'Chapter Review'));
    paragraph(intro,'','Choose a chapter to study vocabulary, grammar, examples, exercises, and a final challenge. Your flashcard progress is kept separately.');
    root.append(intro);
    if (!catalog) {
      paragraph(root, 'review-description', loadError || 'Loading all 15 chapters…');
      if (loadError) root.append(button('Retry loading', 'review-action', () => {
        loadError='';ensureCatalog().then(render).catch(()=>{});
      }));
      return;
    }
    const items = el('div','review-chapter-grid');
    for (const {number,id} of REVIEW_CHAPTERS) {
      const def = number === 11
        ? {title:'Telling Time',subtitle:'Hours, minutes and daily routines'}
        : catalog.chapters.find(c => c.number === number);
      if (!def) continue;
      const progress = chapterState(state.lessonProgress,id);
      const item = button('', 'review-chapter-card', () => openChapter(number));
      item.setAttribute('aria-label','Open Chapter '+number+': '+def.title);
      item.append(el('span','review-chapter-num','CHAPTER '+number));
      item.append(el('span','review-chapter-name',def.title));
      const caption = progress.attempts
        ? 'Best challenge: '+progress.bestScore+'% · '+progress.visited.length+'/5 screens'
        : progress.visited.length ? progress.visited.length+'/5 screens visited' : 'Not started';
      item.append(el('span','review-chapter-meta',caption));
      const track = el('div','review-progress-track');
      const fill = el('span','review-progress-fill');
      fill.style.width = (progress.visited.length/5*100)+'%';
      track.append(fill);
      item.append(track);
      items.append(item);
    }
    root.append(items);
  }
  function setScreen(next) {
    screen = Math.max(0, Math.min(REVIEW_SCREENS.length - 1, next));
    markVisited(screen);
    render();
    review.scrollIntoView({behavior:'auto',block:'start'});
  }
  function render() {
    if (review.hidden) return;
    root.replaceChildren();
    if (!selectedChapter) {if(showChapterList) dashboard(); else practiceHome();return;}
    root.append(button('← All 15 chapters','review-small-button review-back', () => {location.hash='review/chapters';}));
    if (!lesson || lesson.number !== selectedChapter) {
      paragraph(root, 'review-description', loadError || ('Loading Chapter '+selectedChapter+'…'));
      if (loadError) root.append(button('Retry', 'review-action', () => {
        loadError='';ensureLesson().then(render).catch(()=>{});
      }));
      return;
    }
    const header = el('div','review-header');
    const top = el('div','review-heading');
    top.append(el('p','review-kicker','HSK STANDARD COURSE 1 · CHAPTER '+lesson.number));
    top.append(el('h1','',lesson.title));
    paragraph(top,'review-description',lesson.subtitle || (lesson.zh+' · '+lesson.py));
    header.append(top);
    const chapterProgress = chapter();
    paragraph(header,'review-status','Screens visited: '+chapterProgress.visited.length+'/5' +
      (chapterProgress.attempts ? ' · Best challenge: '+chapterProgress.bestScore+'%' : ''));
    root.append(header);
    const tabs = el('div','review-steps');
    tabs.setAttribute('role','tablist');
    tabs.setAttribute('aria-label','Chapter '+lesson.number+' lesson screens');
    REVIEW_SCREENS.forEach((label,index) => {
      const step = button((index+1)+'. '+label,'review-step'+(index===screen?' is-current':''),()=>setScreen(index));
      step.setAttribute('role','tab');
      step.setAttribute('aria-selected',String(index===screen));
      step.setAttribute('aria-controls','reviewScreenContent');
      tabs.append(step);
    });
    root.append(tabs);
    const content = el('div','review-screen');
    content.id='reviewScreenContent';
    content.setAttribute('role','tabpanel');
    if (screen === 0) vocabulary(content);
    if (screen === 1) concepts(content);
    if (screen === 2) examples(content);
    if (screen === 3) practice(content);
    if (screen === 4) challenge(content);
    root.append(content);
    const nav = el('div','review-bottom-nav');
    if (screen > 0) nav.append(button('← Previous','review-small-button',()=>setScreen(screen-1)));
    if (screen < REVIEW_SCREENS.length-1) nav.append(button('Next: '+REVIEW_SCREENS[screen+1]+' →','review-action',()=>setScreen(screen+1)));
    root.append(nav);
  }
  async function ensureCatalog() {
    if (catalog) return;
    if (!catalogLoading) {
      catalogLoading = (async () => {
        const response = await fetch('data/lessons/catalog.json');
        if (!response.ok) throw new Error('Could not load the chapter catalog.');
        const payload = await response.json();
        validateLessonCatalog(payload);
        catalog = payload;
        loadError='';
      })().catch(error=>{
        catalogLoading=null;
        loadError=error.message || 'Could not load the chapter catalog.';
        throw error;
      });
    }
    return catalogLoading;
  }
  async function ensureLesson() {
    const number = selectedChapter;
    if (!number || lesson?.number === number) return;
    if (loading?.number === number) return loading.promise;
    // Book-card chapters are compiled only after the flashcard manifest has loaded.
    if (number !== 11 && !getCards().length) return;
    const promise = (async()=>{
      await ensureCatalog();
      let payload;
      if (number === 11) {
        const response = await fetch('data/lessons/chapter-11.json');
        if (!response.ok) throw new Error('Could not load Chapter 11.');
        payload = await response.json();
      } else {
        const definition = catalog.chapters.find(c=>c.number===number);
        const cards = getCards();
        const sentences = cards.filter(card=>card.type==='sentence' && card.topic==='HSK 1 · Chapter '+number);
        const words = cards.filter(card=>card.topic==='HSK Book 1 vocabulary' && card.lesson===number);
        payload = buildChapterReviewLesson(definition,sentences,words);
      }
      validateReviewLesson(payload);
      if (selectedChapter === number) {
        lesson=payload;
        loadError='';
        markVisited(screen);
      }
    })().catch(error=>{
      if (selectedChapter === number) loadError=error.message || 'Could not load the lesson.';
      throw error;
    }).finally(()=>{if (loading?.number===number) loading=null;});
    loading = {number,promise};
    return promise;
  }
  function refresh() {
    if (!dailyView.hidden) {dailyUI.refresh();return;}
    if (!vocabView.hidden) {vocabUI.refresh();return;}
    if (!listeningView.hidden) {listeningUI.refresh();return;}
    if (review.hidden) return;
    render();
    if(showChapterList || selectedChapter) {
      ensureCatalog().then(()=>ensureLesson()).then(render).catch(()=>render());
    }
  }
  function syncMode() {
    const match = /^#review(?:\/(chapters|[1-9]|1[0-5]))?$/.exec(location.hash);
    const isReview = Boolean(match);
    const isListening = /^#listen(?:\/[a-z-]+)?$/.test(location.hash);
    const isVocab = /^#vocab(?:\/(?:lesson|review)\/(?:extended|all)(?:\/\d{1,2})?)?$/.test(location.hash);
    const isDaily = /^#daily(?:\/session)?$/.test(location.hash);
    const isPractice = isReview || isListening || isVocab || isDaily;
    const showList = match?.[1] === 'chapters';
    const target = match?.[1] && !showList ? Number(match[1]) : null;
    if (target !== selectedChapter) {
      selectedChapter=target;
      resetChapterSession();
    }
    showChapterList=showList;
    flashcards.hidden = isPractice;
    review.hidden = !isReview;
    listeningView.hidden = !isListening;
    vocabView.hidden = !isVocab;
    dailyView.hidden = !isDaily;
    cardTab.classList.toggle('is-active',!isPractice);
    reviewTab.classList.toggle('is-active',isPractice && !isDaily);
    dailyTab.classList.toggle('is-active',isDaily);
    cardTab.setAttribute('aria-selected',String(!isPractice));
    reviewTab.setAttribute('aria-selected',String(isPractice && !isDaily));
    dailyTab.setAttribute('aria-selected',String(isDaily));
    listeningUI.route();
    vocabUI.route();
    dailyUI.route();
    if (isReview) {
      stopAudio();
      refresh();
    }
  }
  cardTab.addEventListener('click', () => {location.hash='cards';});
  reviewTab.addEventListener('click', () => {location.hash='review';});
  dailyTab.addEventListener('click', () => {location.hash='daily';});
  window.addEventListener('hashchange',syncMode);
  syncMode();
  return {refresh};
}
