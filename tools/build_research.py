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
for r in rows:
    # Rank is a sourced accomplishment, never an inverse of subjective points.
    r['rank']='unknown'
    for label,key in [('プレデター','predator'),('マスター','master'),('ダイヤ','diamond'),('プラチナ','platinum'),('ゴールド','gold'),('シルバー','silver'),('ブロンズ','bronze'),('ルーキー','rookie')]:
        if label in (r.get('rankLabel') or ''):
            r['rank']=key
            break
    r['formerApexPro']=r['id']=='yukio'
    if r['id']=='yukio':
        r['rank']='former-pro'
        r['rankLabel']='プレデター（本人の過去到達報告）／元APEXプロ'
        r['rankPeriod']='2022-09-10の本人到達報告。競技活動は2024-10まで。現在ランクではない。'
        r['evidence'].append({'kind':'secondary','title':'@YukioFPS プレデター到達報告の転載','url':'https://twfan.net/user/1123532598456619014/old/13','date':'2022-09-10','note':'本人投稿の転載でプレデター到達を確認。現在ランクとはしない。'})
followup=[]
for group in ['a','b','c']:
    followup.extend(json.loads((ROOT/f'docs/rank-followup-{group}.json').read_text(encoding='utf-8'))['players'])
assert len(followup)==37 and len({r['id'] for r in followup})==37
assert {r['id'] for r in followup}=={r['id'] for r in rows if r['rank']=='unknown'}
for update in followup:
    r=by_id[update['id']]
    assert len(set(update['queries'])-set(r['queries']))>=2,r['id']
    r['queries']=list(dict.fromkeys(r['queries']+update['queries']))
    r['additionalResearch']={k:v for k,v in update.items() if k not in ['id','name']}
    if update['rank']!='unknown':
        assert update['evidence'] and update['rankPeriod'],r['id']
        for key in ['rank','rankLabel','rankPeriod','confidence','researchStatus']:
            r[key]=update[key]
        r['evidence'].extend(update['evidence'])
points={'unknown':2,'rookie':1,'bronze':2,'silver':3,'gold':4,'platinum':5,'diamond':6,'master':7,'predator':8,'former-pro':10,'other-fps-pro':7,'other-fps-top':6,'other-fps-master':5,'other-fps-diamond':4}
fps=[]
for group in ['a','b','c']:
    fps.extend(json.loads((ROOT/f'docs/fps-research-{group}.json').read_text(encoding='utf-8'))['players'])
assert len(fps)==60 and {r['id'] for r in fps}==set(by_id) and len({r['id'] for r in fps})==60
fps_by_id={r['id']:r for r in fps}
for f in fps:
    assert f['category'] in ['pro','high','none'] and f['queries']
    assert f['points'] in ({'pro':[7],'high':[4,5,6],'none':[0]})[f['category']]
    if f['points']:
        assert f['game'] and f['achievement'] and f['evidence'],f['id']
        assert all(e['url'].startswith('https://') for e in f['evidence'])
for r in rows:
    r['apexRank']=r['rank']
    f=fps_by_id[r['id']]
    r['fpsResearch']={k:v for k,v in f.items() if k not in ['id','name']}
    if f['points']>points[r['rank']]:
        r['rank']='other-fps-pro' if f['category']=='pro' else {6:'other-fps-top',5:'other-fps-master',4:'other-fps-diamond'}[f['points']]
    r['legacyRating5']=r['rating']
    r['rating']=points[r['rank']]
    r['ratingSource']='rank-fixed' if r['rank']!='unknown' else 'user-default'
    r['ratingBasis']='APEX実績と他FPS実績の固定ポイントのうち高い方を採用。' if r['rank']!='unknown' else '配点基準に該当するFPS実績を確認できず、本人指定の基準2点。'
    r['researchStatus']='found' if r['rank']!='unknown' else 'insufficient'
rows=[by_id[p['id']] for p in roster]
summary={'searched':60,'ranked':sum(r['rank']!='unknown' for r in rows),'rankUnknown':sum(r['rank']=='unknown' for r in rows),'apexRanked':sum(r['apexRank']!='unknown' for r in rows),'apexUnknown':sum(r['apexRank']=='unknown' for r in rows),'rated':60,'unrated':0,'organizationsVerified':sum(r['organizationStatus']=='verified' for r in rows),'iglVerified':sum(r['igl']=='yes' for r in rows),'followupSearched':len(followup),'followupAdded':sum(r['rank']!='unknown' for r in followup),'followupQueries':sum(len(r['queries']) for r in followup),'fpsResearched':len(fps),'fpsPro':sum(r['category']=='pro' for r in fps),'fpsHigh':sum(r['category']=='high' for r in fps),'fpsApplied':sum(r['rank'].startswith('other-fps-') for r in rows),'fpsQueries':sum(len(r['queries']) for r in fps)}
payload={'version':'2026-11-24-r5-fps-evidence','checkedAt':'2026-11-24','ratingScale':10,'pointSystem':'fps-evidence-v1','rankPoints':points,'summary':summary,'rubric':{'10':'元APEXプロ','8':'プレデター','7':'APEXマスター・他FPS元プロ','6':'APEXダイヤ・他FPS最高帯','5':'APEXプラチナ・他FPSマスター相当','4':'ゴールド・他FPSダイヤ相当','3':'シルバー','2':'ブロンズ・実績未確認','1':'ルーキー'},'players':rows}
out=ROOT/'site/research.js'
out.write_text('window.LTK_RESEARCH='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
(ROOT/'docs/public-research.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
(WORK/'research-package-audit.json').write_text(json.dumps({'summary':summary,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'ids':[r['id'] for r in rows]},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))
