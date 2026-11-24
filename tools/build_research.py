"""Package reviewed public research; does not read browser/local user settings."""
from pathlib import Path
import json
import hashlib

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT.parents[1]/'work/apex-research-20261124'
text=(ROOT/'site/roster.js').read_text(encoding='utf-8-sig')
roster=json.loads(text.split('=',1)[1].rstrip(';\n'))['players']
rows=[]
for name in ['group-a.json','group-b.json','group-c.json']:
    rows.extend(json.loads((WORK/name).read_text(encoding='utf-8-sig')))
assert len(rows)==60 and len({r['id'] for r in rows})==60
assert {r['id'] for r in rows}=={r['id'] for r in roster}
for r in rows:
    if r.get('organization')=='RIDDLE ORDER':r['organization']='RIDDLE'
    assert r['queries'] and r['researchStatus'] in ['found','insufficient'],r['id']
    assert r['rating'] is None or type(r['rating']) is int and 1<=r['rating']<=5
    assert r['igl'] in ['yes','no','unknown']
    assert r['organizationStatus'] in ['verified','unknown','former']
    assert '\ufffd' not in json.dumps(r,ensure_ascii=False)
    if r['rating'] is not None:
        assert r.get('evidence') or r['id'] in ['yukio','yufuna'],r['id']
    if r['organizationStatus']=='verified':
        assert r['organization'] and r['organizationsEvidence'],r['id']
    for s in r.get('evidence',[])+r.get('organizationsEvidence',[]):
        assert s.get('url','').startswith('https://'),s
    r['ratingSource']='user' if r['id'] in ['yukio','yufuna'] else 'inferred' if r['rating'] is not None else 'unknown'
for id in ['yukio','yufuna']:
    assert next(r for r in rows if r['id']==id)['rating']==5
by_id={r['id']:r for r in rows}
rows=[by_id[p['id']] for p in roster]
summary={'searched':60,'rated':sum(r['rating'] is not None for r in rows),'unrated':sum(r['rating'] is None for r in rows),'organizationsVerified':sum(r['organizationStatus']=='verified' for r in rows),'iglVerified':sum(r['igl']=='yes' for r in rows)}
payload={'version':'2026-11-24-r1','checkedAt':'2026-11-24','ratingScale':5,'summary':summary,'rubric':{'5':'元APEXプロ・プレデター','4':'マスター','3':'ダイヤ','2':'確認できる一般経験者','1':'本人が初心者と明示','unknown':'情報不足・未評価'},'players':rows}
out=ROOT/'site/research.js'
out.write_text('window.LTK_RESEARCH='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
(ROOT/'docs/public-research.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
(WORK/'research-package-audit.json').write_text(json.dumps({'summary':summary,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'ids':[r['id'] for r in rows]},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))
