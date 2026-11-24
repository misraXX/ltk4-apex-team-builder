"""Build factual LTK roster relationships; never infer personal friendships."""
import concurrent.futures
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT.parents[1] / 'work' / 'apex-research-20261124'
WORK.mkdir(parents=True, exist_ok=True)
URLS = {
    1: 'https://ltk-data.yaygg.com/spirit-blossom-beyond/core.json',
    2: 'https://ltk-data.yaygg.com/trials-of-twilight/core.json',
    3: 'https://ltk-data.yaygg.com/pandemonium/core.json',
    4: 'https://ltk-data.yaygg.com/core.json',
}

def fetch(item):
    season, url = item
    with urlopen(Request(url, headers={'User-Agent': 'LTK4-Team-Builder-Research/1.1'}), timeout=45) as response:
        body = response.read()
    data = json.loads(body.decode('utf-8-sig'))
    (WORK / f'ltk{season}-core.json').write_bytes(body)
    return season, data, {'season': season, 'url': url, 'sha256': hashlib.sha256(body).hexdigest(), 'generatedAt': data.get('generatedAt'), 'bytes': len(body)}

roster_text = (ROOT / 'site/roster.js').read_text(encoding='utf-8-sig')
roster = json.loads(roster_text.split('=', 1)[1].rstrip(';\n'))['players']
ids = {p['id'] for p in roster}
memberships = {p['id']: [] for p in roster}
sources, checks = [], []
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(fetch, URLS.items()))
for season, data, source in sorted(results):
    people = [p for p in data['people'] if p.get('role') and not p.get('coach')]
    assert len({p['id'] for p in people}) == len(people), f'duplicate roster: LTK{season}'
    teams = {t['key']: t['name'] for t in data['teams']}
    for p in people:
        assert p['teamKey'] in teams
        if p['id'] in ids:
            memberships[p['id']].append({'season': season, 'team': p['teamKey'], 'teamName': teams[p['teamKey']], 'tier': p['tier'], 'role': p['role']})
    if season == 4:
        assert ids == {p['id'] for p in people}, 'current 60-person roster mismatch'
        for p in roster:
            fresh = next(x for x in people if x['id'] == p['id'])
            assert fresh['teamKey'] == p['team'], f'LTK4 affiliation drift: {p["id"]}'
            assert fresh['name'] == p['name'], f'name drift: {p["id"]}'
    checks.append({'season': season, 'regularPlayers': len(people), 'matchedCurrentPlayers': sum(p['id'] in ids for p in people), 'teams': len(teams)})
    sources.append(source)
pairs = []
for i, a in enumerate(roster):
    for b in roster[i+1:]:
        shared = []
        for x in memberships[a['id']]:
            for y in memberships[b['id']]:
                if x['season'] == y['season'] and x['team'] == y['team']:
                    shared.append({'season': x['season'], 'team': x['team'], 'sameTier': x['tier'] == y['tier']})
        if shared:
            pairs.append({'a': a['id'], 'b': b['id'], 'shared': shared})
result = {'version': 1, 'checkedAt': datetime.now(timezone.utc).isoformat(), 'memberships': memberships, 'pairs': pairs, 'sources': sources, 'checks': checks, 'definition': '公開HUBの正規名簿上の同チーム。所属15人と同階級を区別し、私的な親しさや助っ人共演とは区別する。'}
(ROOT / 'site/ltk-relations.js').write_text('window.LTK_RELATIONS=' + json.dumps(result, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
(WORK / 'ltk-relations-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'checks': checks, 'pairs': len(pairs), 'pastPairs': sum(any(s['season'] < 4 for s in p['shared']) for p in pairs)}, ensure_ascii=False))
