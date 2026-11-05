import {state, saveLessonProgress} from './storage.js';
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

export function initReview({getCards, playAudio, stopAudio}) {
  const flashcards = document.getElementById('flashcardsView');
  const review = document.getElementById('reviewView');
  const root = document.getElementById('reviewRoot');
  const cardTab = document.getElementById('cardsTab');
  const reviewTab = document.getElementById('reviewTab');
  if (!flashcards || !review || !root || !cardTab || !reviewTab) return {refresh() {}};

  let lesson = null;
  let loading = null;
  let screen = 0;
  let showPinyin = true;
  let showEnglish = true;
  let practiceIndex = 0;
  let practiceResults = {};
  let practiceFinished = false;
  let challengeIndex = 0;
  let challengeResults = {};
  let challengeFinished = false;

  const chapter = () => chapterState(state.lessonProgress, 'chapter-11');
  const save = value => {
    state.lessonProgress = {...state.lessonProgress, 'chapter-11': value};
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
      'Start with the words assigned to Chapter 11 in your existing flashcard data, then review the supporting time expressions.');
    toggles(container);
    const book = getCards().filter(card => card.topic === 'HSK Book 1 vocabulary' && card.lesson === 11);
    const bookPanel = el('section', 'review-panel');
    bookPanel.append(el('h3', '', 'From your HSK Book 1 · Chapter 11 bank'));
    if (!book.length) paragraph(bookPanel, 'review-description', 'Vocabulary is loading. The supporting expressions below are available now.');
    for (const word of book) bookPanel.append(lineCard(word.zh, word.py, word.en));
    container.append(bookPanel);
    const extra = el('section', 'review-panel');
    extra.append(el('h3', '', 'Supporting expressions'));
    paragraph(extra, 'review-note', 'Useful for conversation. Some expressions extend beyond the Chapter 11 word list.');
    for (const word of lesson.supportingWords) extra.append(lineCard(word.zh, word.py, word.en));
    container.append(extra);
  }
  function concepts(container) {
    heading(container, 'SCREEN 2 · UNDERSTAND', 'How to tell time',
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
    const note = el('aside', 'review-tip');
    note.append(el('strong', '', 'Tone check'));
    paragraph(note, '', '工作 gōngzuò (1st + 4th); 下午 xiàwǔ (4th + 3rd); 然后 ránhòu (2nd + 4th); 睡觉 shuìjiào (4th + 4th).');
    container.append(note);
  }
  function examples(container) {
    heading(container, 'SCREEN 3 · READ & LISTEN', 'Short stories and dialogues',
      'Follow the full sentence, then hide pinyin or English and read it again.');
    toggles(container);
    for (const [index, story] of lesson.stories.entries()) {
      const panel = el('section', 'review-panel');
      panel.append(el('p', 'review-section-label', 'EXAMPLE ' + (index + 1)));
      panel.append(el('h3', '', story.title));
      if (showPinyin) paragraph(panel, 'review-pinyin', story.py);
      if (showEnglish) paragraph(panel, 'review-english', story.en);
      for (const sample of story.lines) panel.append(lineCard(...sample));
      panel.append(button('▶ Listen to the full story', 'review-action secondary', () =>
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
    heading(container, 'SCREEN 5 · TEST YOURSELF', 'Chapter 11 challenge',
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
  function setScreen(next) {
    screen = Math.max(0, Math.min(REVIEW_SCREENS.length - 1, next));
    markVisited(screen);
    render();
    review.scrollIntoView({behavior:'instant', block:'start'});
  }
  function render() {
    if (review.hidden) return;
    root.replaceChildren();
    if (!lesson) {paragraph(root, 'review-description', 'Loading Chapter 11 lesson…');return;}
    const header = el('div','review-header');
    const top = el('div','review-heading');
    top.append(el('p','review-kicker','HSK STANDARD COURSE 1 · CHAPTER 11'));
    top.append(el('h1','',lesson.title));
    paragraph(top,'review-description',lesson.zh + ' · ' + lesson.py);
    header.append(top);
    const chapterProgress = chapter();
    paragraph(header,'review-status','Screens visited: '+chapterProgress.visited.length+'/5' +
      (chapterProgress.attempts ? ' · Best challenge: '+chapterProgress.bestScore+'%' : ''));
    root.append(header);
    const tabs = el('div','review-steps');
    tabs.setAttribute('role','tablist');
    tabs.setAttribute('aria-label','Chapter 11 lesson screens');
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
    if (screen > 0) nav.append(button('← Previous', 'review-small-button',()=>setScreen(screen-1)));
    if (screen < REVIEW_SCREENS.length-1) nav.append(button('Next: '+REVIEW_SCREENS[screen+1]+' →','review-action',()=>setScreen(screen+1)));
    root.append(nav);
  }
  async function ensureLesson() {
    if (lesson) return;
    if (!loading) loading = (async () => {
      const response = await fetch('data/lessons/chapter-11.json');
      if (!response.ok) throw new Error('Chapter lesson could not be loaded.');
      const payload = await response.json();
      validateReviewLesson(payload);
      lesson = payload;
      markVisited(screen);
    })().catch(err => {
      loading = null;
      root.replaceChildren();
      const block=el('div','review-panel');
      paragraph(block,'review-description',err.message || 'Could not load the lesson.');
      block.append(button('Retry', 'review-action', () => {ensureLesson().then(render);}));
      root.append(block);
      throw err;
    });
    return loading;
  }
  function syncMode() {
    const isReview = location.hash === '#review';
    flashcards.hidden = isReview;
    review.hidden = !isReview;
    cardTab.classList.toggle('is-active',!isReview);
    reviewTab.classList.toggle('is-active',isReview);
    cardTab.setAttribute('aria-selected',String(!isReview));
    reviewTab.setAttribute('aria-selected',String(isReview));
    if (isReview) {
      stopAudio();
      render();
      ensureLesson().then(render).catch(()=>{});
    }
  }
  cardTab.addEventListener('click', () => {location.hash = 'cards';});
  reviewTab.addEventListener('click', () => {location.hash = 'review';});
  window.addEventListener('hashchange',syncMode);
  syncMode();
  return {refresh(){if (!review.hidden && lesson) render();}};
}
