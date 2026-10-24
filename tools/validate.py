"""Validate vocabulary packs and HSK1-focused sentence packs."""
import json
from collections import Counter
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'data/manifest.json').read_text(encoding='utf-8'))
ids = set()
pack_ids = set()
word_packs = {}
word_count = 0
sentence_count = Counter()
for entry in manifest['packs']:
    path=entry['file']
    assert path.startswith('data/packs/') and path.endswith('.json'), path
    assert entry['id'] not in pack_ids, f'duplicate pack ID: {entry["id"]}'
    pack_ids.add(entry['id'])
    data = json.loads((ROOT / path).read_text(encoding='utf-8'))
    assert data['id'] == entry['id'], path
    if not path.startswith('data/packs/sentences-'):
        word_packs[data['id']] = [c['zh'] for c in data['cards']]
    for c in data['cards']:
        cid = str(c['id'])
        assert cid and len(cid) < 128 and cid not in ids, ('duplicate/invalid ID', cid)
        ids.add(cid)
        for required in ('zh','py','en','topic'):
            assert isinstance(c[required],str) and c[required].strip(), (cid,required)
        if c.get('type') == 'sentence':
            difficulty=c['difficulty']
            assert difficulty in ('easy','medium','hard'), cid
            assert cid.startswith(f'sentence-{difficulty}-'), cid
            assert c['sourcePack'] in word_packs, (cid, c['sourcePack'])
            assert c['breakdown'] and len(c['breakdown']) >= 2, cid
            assert all(all(isinstance(piece.get(k),str) and piece[k] for k in ('zh','py','en')) for piece in c['breakdown']), cid
            words = ''.join(part['zh'] for part in c['breakdown'])
            assert ''.join(x for x in c['zh'] if x not in '，。？！') == words, (cid, 'missing breakdown tokens')
            # Each sentence is strongly anchored to its source word pack, not a random sentence.
            matches = [w for w in word_packs[c['sourcePack']] if w in c['zh']]
            assert len(matches) >= 2, (cid,'insufficient source pack vocabulary',matches)
            sentence_count[difficulty] += 1
        else:
            assert len(c['examples']) == 2, cid
            for e in c['examples']:
                assert len(e) == 3 and all(isinstance(s,str) and s.strip() for s in e), cid
                assert c['zh'] in e[0], (cid,c['zh'],e[0])
            word_count += 1
assert word_count == 335, word_count
assert sentence_count == {'easy':40,'medium':40,'hard':20}, sentence_count
print(f'PASS: {word_count} original word cards, {sum(sentence_count.values())} sentences ({dict(sentence_count)}) across {len(pack_ids)} packs.')
