"""Validate every registered vocabulary, sentence and HSK test-prep card."""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'data/manifest.json').read_text(encoding='utf-8'))
ids, pack_ids = set(), set()
word_packs = {}
word_count = 0
sentence_count, chapter_count, test_count = Counter(), Counter(), Counter()
chapter_packs = {'hsk-chapters-01-10', 'hsk-chapters-11-15'}

for entry in manifest['packs']:
    path = entry['file']
    assert path.startswith('data/packs/') and path.endswith('.json'), path
    assert entry['id'] not in pack_ids, f'duplicate pack ID: {entry["id"]}'
    pack_ids.add(entry['id'])
    data = json.loads((ROOT / path).read_text(encoding='utf-8'))
    assert data['id'] == entry['id'], path
    if not path.startswith('data/packs/sentences-') and data['id'] not in chapter_packs | {'hsk-test-prep'}:
        word_packs[data['id']] = [c['zh'] for c in data['cards']]
    for card in data['cards']:
        cid = str(card['id'])
        assert cid and len(cid) < 128 and cid not in ids, ('duplicate/invalid ID', cid)
        ids.add(cid)
        for required in ('zh', 'py', 'en', 'topic'):
            assert isinstance(card[required], str) and card[required].strip(), (cid, required)
        if card.get('type') == 'test':
            assert data['id'] == 'hsk-test-prep' and card['topic'] == 'HSK Test Prep', cid
            assert card['section'] in ('listening', 'reading'), cid
            assert isinstance(card['question'], str) and card['question'].strip(), cid
            assert len(card['choices']) == 3 and all(isinstance(x, str) and x.strip() for x in card['choices']), cid
            assert len(set(card['choices'])) == 3, cid
            assert type(card['answer']) is int and 0 <= card['answer'] < 3, cid
            assert isinstance(card['explanation'], str) and card['explanation'].strip(), cid
            test_count[card['section']] += 1
        elif card.get('type') == 'sentence':
            difficulty = card['difficulty']
            assert difficulty in ('easy', 'medium', 'hard'), cid
            assert cid.startswith(f'sentence-{difficulty}-'), cid
            assert card['sourcePack'] in word_packs, (cid, card['sourcePack'])
            is_chapter = data['id'] in chapter_packs
            assert len(card['breakdown']) >= (1 if is_chapter else 2), cid
            assert all(all(isinstance(piece.get(k), str) and piece[k] for k in ('zh','py','en')) for piece in card['breakdown']), cid
            tokens = ''.join(piece['zh'] for piece in card['breakdown'])
            assert ''.join(x for x in card['zh'] if x not in '，。？！') == tokens, (cid, 'missing breakdown tokens')
            if is_chapter:
                assert card['topic'].startswith('HSK 1 · Chapter '), cid
                chapter_count[int(card['topic'].split('Chapter ')[1])] += 1
            else:
                matches = [word for word in word_packs[card['sourcePack']] if word in card['zh']]
                assert len(matches) >= 2, (cid, 'insufficient source pack vocabulary', matches)
                sentence_count[difficulty] += 1
        else:
            assert len(card['examples']) == 2, cid
            for example in card['examples']:
                assert len(example) == 3 and all(isinstance(s, str) and s.strip() for s in example), cid
                assert card['zh'] in example[0], (cid, card['zh'], example[0])
            word_count += 1

assert word_count == 335, word_count
assert sentence_count == {'easy': 40, 'medium': 40, 'hard': 20}, sentence_count
assert chapter_count == {i: 10 for i in range(1, 16)}, chapter_count
assert test_count == {'listening': 20, 'reading': 20}, test_count
print(f'PASS: {word_count} vocabulary, {sum(sentence_count.values())} practice sentences, '
      f'{sum(chapter_count.values())} chapter sentences, {sum(test_count.values())} HSK test questions '
      f'across {len(pack_ids)} packs.')
