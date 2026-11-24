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
for r in rows:
    old=r['rating'];r['legacyRating5']=old
    r['rating']=None if old is None else {1:2,2:4,3:6,4:7,5:8}[old]
    if r['id']=='yukio':
        r['rating']=10
        r['ratingBasis']='RIDDLE公式が元APEX競技プロ・世界大会出場を明記。10段階では元競技プロの基準として仮10。'
    elif r['id']=='yufuna':
        r['rating']=9
        r['ratingBasis']='ユーザーが上位基準に挙げたプレデター経験者。本人の到達動画もあり、10段階の暫定基準を9とする。'
    elif r['id']=='kinako':
        r['rating']=9
    if old is not None:
        r['ratingBasis']=r['ratingBasis'].replace('仮'+str(old),'仮'+str(r['rating'])) if r['id'] not in ['yukio','yufuna'] else r['ratingBasis']
    r['ratingSource']='inferred' if r['rating'] is not None else 'unknown'
by_id={r['id']:r for r in rows}
for r in rows:
    # Rank is a sourced accomplishment, never an inverse of subjective points.
    r['rank']='unknown'
    for label,key in [('プレデター','predator'),('マスター','master'),('ダイヤ','diamond'),('プラチナ','platinum'),('ゴールド','gold'),('シルバー','silver'),('ブロンズ','bronze'),('ルーキー','rookie')]:
        if label in (r.get('rankLabel') or ''):
            r['rank']=key
            break
    r['formerApexPro']=r['id']=='yukio'
    if r['id']=='yukio':
        r['rank']='predator'
        r['rankLabel']='プレデター（本人の過去到達報告）／元APEXプロ'
        r['rankPeriod']='2022-09-10の本人到達報告。競技活動は2024-10まで。現在ランクではない。'
        r['evidence'].append({'kind':'secondary','title':'@YukioFPS プレデター到達報告の転載','url':'https://twfan.net/user/1123532598456619014/old/13','date':'2022-09-10','note':'本人投稿の転載でプレデター到達を確認。現在ランクとはしない。'})
rows=[by_id[p['id']] for p in roster]
summary={'searched':60,'ranked':sum(r['rank']!='unknown' for r in rows),'rankUnknown':sum(r['rank']=='unknown' for r in rows),'rated':sum(r['rating'] is not None for r in rows),'unrated':sum(r['rating'] is None for r in rows),'organizationsVerified':sum(r['organizationStatus']=='verified' for r in rows),'iglVerified':sum(r['igl']=='yes' for r in rows)}
payload={'version':'2026-11-24-r3-rank-display','checkedAt':'2026-11-24','ratingScale':10,'summary':summary,'rubric':{'10':'元APEX競技プロの内部基準','8-9':'プレデター実績の内部基準','7':'マスター実績','6':'ダイヤ実績','3-4':'一般経験者','1-2':'初心者','unknown':'情報不足'},'players':rows}
out=ROOT/'site/research.js'
out.write_text('window.LTK_RESEARCH='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
(ROOT/'docs/public-research.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
(WORK/'research-package-audit.json').write_text(json.dumps({'summary':summary,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'ids':[r['id'] for r in rows]},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))
