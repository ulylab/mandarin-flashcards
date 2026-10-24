"""Validate vocabulary data packs before publishing."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'data/manifest.json').read_text(encoding='utf-8'))
ids = set()
files = set()
total = 0
for item in manifest['packs']:
    file = item['file']
    assert file.startswith('data/packs/') and file.endswith('.json'), file
    assert file not in files, f'duplicate pack: {file}'
    files.add(file)
    data = json.loads((ROOT / file).read_text(encoding='utf-8'))
    assert data['id'] == item['id'], file
    for c in data['cards']:
        cid = str(c['id'])
        assert cid not in ids, f'duplicate card ID: {cid}'
        assert cid and len(cid) < 128
        ids.add(cid)
        for required in ('zh', 'py', 'en', 'topic'):
            assert isinstance(c[required], str) and c[required].strip(), (cid, required)
        assert len(c['examples']) == 2, cid
        for e in c['examples']:
            assert len(e) == 3 and all(isinstance(s, str) and s.strip() for s in e), cid
            assert c['zh'] in e[0], (cid, c['zh'], e[0])
        total += 1
print(f'PASS: {total} valid cards across {len(files)} independently loadable packs')
