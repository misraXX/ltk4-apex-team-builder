(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LTKCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  const effectiveRating = m => m.rating == null ? 5 : m.rating;
  const ranks = {unknown:'未確認',rookie:'ルーキー',bronze:'ブロンズ',silver:'シルバー',gold:'ゴールド',platinum:'プラチナ',diamond:'ダイヤモンド',master:'マスター',predator:'プレデター'};
  function rankRating(rank, research={}) {return rank===research.rank&&research.rating!=null?research.rating:({unknown:null,rookie:1,bronze:2,silver:3,gold:4,platinum:5,diamond:6,master:7,predator:9})[rank];}
  const pairKey = (a,b) => [a,b].sort().join('|');
  function createState(roster, research={}) {
    return { version:3, eventName:'LTK4 APEX CUSTOM', members:Object.fromEntries(roster.map(p=>{const r=research[p.id]||{};return [p.id,{attending:true,rank:r.rank||'unknown',rating:r.rating??null,igl:r.igl||'unknown',social:'none',friends:[],note:'',organization:r.organizationStatus==='verified'?(r.organization||''):''}];})), settings:{sameTeam:true,pastTeam:true,sameOrganization:true,repeat:true}, draft:null, history:[] };
  }
  function capacities(n) {
    if (!Number.isInteger(n) || n < 2 || n > 60) throw Error('出席者を2〜60人にしてください。');
    const sizes=Array(Math.floor(n/3)).fill(3);
    if (n%3===2) sizes.push(2);
    if (n%3===1) { sizes.pop(); sizes.push(2,2); }
    return sizes;
  }
  function pairCounts(history) {
    const counts = new Map();
    for (const match of history) for (const team of match.teams) for (let i=0;i<team.length;i++) for(let j=i+1;j<team.length;j++) {
      const k=pairKey(team[i],team[j]); counts.set(k,(counts.get(k)||0)+1);
    }
    return counts;
  }
  function validateState(raw, roster, migration=false) {
    const fail = s => { throw Error('設定ファイルを読み込めません：'+s); };
    const legacy=migration&&raw?.version===1, fivePoint=migration&&raw?.version===2;
    if (!raw || (raw.version!==3&&!legacy&&!fivePoint) || !raw.members || !Array.isArray(raw.history)) fail('対応していない形式です。');
    const ids=new Set(roster.map(p=>p.id)), state=createState(roster);
    if (Object.keys(raw.members).length!==60 || Object.keys(raw.members).some(id=>!ids.has(id))) fail('60人の名簿が一致しません。');
    if (typeof raw.eventName!=='string' || raw.eventName.length>80) fail('イベント名が不正です。');
    state.eventName=raw.eventName;
    for (const id of ids) {
      const m=raw.members[id];
      if (!m || typeof m.attending!=='boolean' || !(m.rating===null || Number.isInteger(m.rating)&&m.rating>=1&&m.rating<=(fivePoint?5:10))) fail('戦力点・出欠が不正です。');
      if (!['yes','no','unknown'].includes(m.igl) || !['required','prefer','none'].includes(m.social)) fail('IGL・関係性の設定が不正です。');
      if (!Array.isArray(m.friends)||m.friends.length>59||m.friends.some(x=>!ids.has(x)||x===id)||new Set(m.friends).size!==m.friends.length) fail('知り合いの指定が不正です。');
      if (typeof m.note!=='string'||m.note.length>500) fail('メモは500文字以内にしてください。');
      const organization=legacy?'':m.organization;
      if(typeof organization!=='string'||organization.length>80)fail('所属組織が不正です。');
      const rank=legacy||fivePoint?'unknown':m.rank;
      if(typeof rank!=='string'||!Object.hasOwn(ranks,rank))fail('ランクが不正です。');
      state.members[id]={attending:m.attending,rank,rating:fivePoint&&m.rating!==null?m.rating*2:m.rating,igl:m.igl,social:m.social,friends:[...m.friends],note:m.note,organization};
    }
    if (!raw.settings || typeof raw.settings.sameTeam!=='boolean'||typeof raw.settings.repeat!=='boolean') fail('編成方針が不正です。');
    if(!legacy&&(typeof raw.settings.pastTeam!=='boolean'||typeof raw.settings.sameOrganization!=='boolean'))fail('関係性の編成方針が不正です。');
    state.settings={sameTeam:raw.settings.sameTeam,pastTeam:legacy?true:raw.settings.pastTeam,sameOrganization:legacy?true:raw.settings.sameOrganization,repeat:raw.settings.repeat};
    function checkTeams(teams, label) {
      if(!Array.isArray(teams)||teams.length<1||teams.length>20) fail(label+'のチーム数が不正です。');
      const flat=teams.flat();
      if(teams.some(t=>!Array.isArray(t)||![2,3].includes(t.length)||t.some(id=>typeof id!=='string'||!ids.has(id)))||new Set(flat).size!==flat.length) fail(label+'の人数・ID・重複が不正です。');
      return teams.map(t=>[...t]);
    }
    if(raw.history.length>2000) fail('履歴が多すぎます。');
    const matchIds=new Set();
    for(const h of raw.history) {
      if(!h||typeof h.id!=='string'||h.id.length>100||matchIds.has(h.id)||typeof h.confirmedAt!=='string'||!Number.isFinite(Date.parse(h.confirmedAt))) fail('マッチ履歴が不正です。');
      const teams=checkTeams(h.teams,'履歴'); matchIds.add(h.id);
      const ratingScale=legacy?10:h.ratingScale;
      if(![5,10].includes(ratingScale))fail('履歴の評価段階が不正です。');
      const scores={};
      if(!h.scores||typeof h.scores!=='object') fail('履歴の評価がありません。');
      for(const id of teams.flat()) {
        const score=h.scores[id];
        if(!score||!Number.isInteger(score.rating)||score.rating<1||score.rating>ratingScale||!['yes','no','unknown'].includes(score.igl)||typeof score.provisional!=='boolean') fail('履歴の評価が不正です。');
        const rank=score.rank===undefined?'unknown':score.rank;if(typeof rank!=='string'||!Object.hasOwn(ranks,rank))fail('履歴のランクが不正です。');
        scores[id]={rating:score.rating,igl:score.igl,provisional:score.provisional,rank};
      }
      state.history.push({id:h.id,confirmedAt:h.confirmedAt,teams,scores,ratingScale});
    }
    if(raw.draft!==null) {
      const d=raw.draft;
      if(!d||typeof d.id!=='string'||d.id.length>100||typeof d.builtAt!=='string'||!Number.isFinite(Date.parse(d.builtAt))) fail('現在案が不正です。');
      state.draft={id:d.id,builtAt:d.builtAt,teams:checkTeams(d.teams,'現在案')};
    }
    return state;
  }
  function migrateV1(raw,roster){if(raw?.version!==1)throw Error('旧設定ではありません。');return validateState(raw,roster,true);}
  function migrateV2(raw,roster){if(raw?.version!==2)throw Error('旧5段階設定ではありません。');return validateState(raw,roster,true);}
  function pastTeamSeasons(a,b){return (a.ltkHistory||[]).filter(x=>[1,2,3].includes(x.season)&&(b.ltkHistory||[]).some(y=>x.season===y.season&&x.team===y.team)).map(x=>x.season);}
  function sameOrganization(a,b){
    const normalize=value=>{const s=(value||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'').trim();const aliases={'riddleorder':'riddle','cr':'crazyraccoon','zeta':'zetadivision','dfm':'detonationfocusme','ネオポルテ':'neo-porte','neoporte':'neo-porte','ぶいすぽ':'ぶいすぽっ!','ぶいすぽっ':'ぶいすぽっ!','vspo':'ぶいすぽっ!'};return aliases[s]||s;};
    const x=normalize(a.organization),y=normalize(b.organization);return !!x&&x===y&&!['個人','個人勢','無所属','所属不明','不明','未確認','フリー','unknown','none'].includes(x);
  }
  function analyze(teams, roster, state) {
    const byId=Object.fromEntries(roster.map(p=>[p.id,p])), counts=pairCounts(state.history), issues=[], flat=teams.flat(), seen=new Set();
    for(const id of flat) {
      if(!byId[id]||!state.members[id]) {issues.push('名簿にないメンバーがいます。');continue;}
      if(seen.has(id)) issues.push(byId[id].name+'さんが重複しています。');
      if(!state.members[id].attending) issues.push(byId[id].name+'さんは欠席に変更されています。');
      seen.add(id);
    }
    for(const p of roster) if(state.members[p.id].attending&&!seen.has(p.id)) issues.push(p.name+'さんが未配置です。');
    const details=teams.map((team,index)=>{
      const members=team.filter(id=>state.members[id]&&byId[id]);
      if(![2,3].includes(team.length)) issues.push('TEAM '+(index+1)+'の人数が不正です。');
      let repeats=0, sameTeamPairs=0, pastTeamPairs=0, organizationPairs=0, preferMisses=0; const unmet=[];
      for(const id of members) {
        const m=state.members[id], has=m.friends.some(f=>team.includes(f));
        if(m.social==='required'&&!has) {const msg=byId[id].name+'さんに指定した知り合いがいません。'; issues.push(msg);unmet.push(id);}
        if(m.social==='prefer'&&!has) preferMisses++;
      }
      for(let i=0;i<members.length;i++) for(let j=i+1;j<members.length;j++) {
        repeats+=counts.get(pairKey(members[i],members[j]))||0;
        if(byId[members[i]].team===byId[members[j]].team) sameTeamPairs++;
        if(pastTeamSeasons(byId[members[i]],byId[members[j]]).length)pastTeamPairs++;
        if(sameOrganization(state.members[members[i]],state.members[members[j]]))organizationPairs++;
      }
      return {total:members.reduce((s,id)=>s+effectiveRating(state.members[id]),0),igl:members.filter(id=>state.members[id].igl==='yes').length,unknownIgl:members.filter(id=>state.members[id].igl==='unknown').length,provisional:members.filter(id=>state.members[id].rating===null||state.members[id]._provisional).length,repeats,sameTeamPairs,pastTeamPairs,organizationPairs,preferMisses,unmet};
    });
    const totals=details.map(d=>d.total), average=totals.length?totals.reduce((a,b)=>a+b,0)/totals.length:0;
    return {valid:issues.length===0&&teams.length>0,issues,details,totals,average,range:totals.length?Math.max(...totals)-Math.min(...totals):0,variance:totals.reduce((s,x)=>s+(x-average)**2,0),iglTeams:details.filter(x=>x.igl>0).length,repeats:details.reduce((s,d)=>s+d.repeats,0),provisional:details.reduce((s,d)=>s+d.provisional,0)};
  }
  function generate(roster,state,options={}) {
    const active=roster.filter(p=>state.members[p.id].attending).map(p=>p.id), sizes=capacities(active.length), set=new Set(active);
    const blocked=active.filter(id=>state.members[id].social==='required'&&!state.members[id].friends.some(f=>set.has(f)));
    if(blocked.length) throw Error(blocked.map(id=>roster.find(p=>p.id===id).name+'さん：出席する知り合い候補がいません。').join('\n'));
    let seed=(options.seed??(Date.now()^Math.floor(Math.random()*0xffffffff)))>>>0;
    function random(){ seed+=0x6D2B79F5;let t=seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296; }
    const byId=Object.fromEntries(roster.map(p=>[p.id,p])), counts=pairCounts(state.history), members=state.members;
    const repeats=state.settings.repeat?14:0, same=state.settings.sameTeam?3:0;
    const relations=new Map();for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){const a=active[i],b=active[j];relations.set(pairKey(a,b),(byId[a].team===byId[b].team?same:0)+(state.settings.pastTeam&&pastTeamSeasons(byId[a],byId[b]).length?3:0)+(state.settings.sameOrganization&&sameOrganization(members[a],members[b])?4:0));}
    function cost(teams) {
      const avg=active.reduce((s,id)=>s+effectiveRating(members[id]),0)/teams.length;
      let result=0;
      for(const t of teams) {
        let total=0,igl=0;
        for(const id of t) {
          const m=members[id];total+=effectiveRating(m);igl+=m.igl==='yes'?1:0;
          if(m.social!=='none'&&!m.friends.some(f=>t.includes(f))) result+=m.social==='required'?100000:32;
        }
        result+=(total-avg)**2*10+Math.max(0,igl-1)*45;
        for(let i=0;i<t.length;i++) for(let j=i+1;j<t.length;j++){const key=pairKey(t[i],t[j]);result+=(counts.get(key)||0)*repeats-(relations.get(key)||0);}
      }
      return result;
    }
    let best,bestCost=Infinity;
    const steps=options.iterations??14000, restarts=options.restarts??5;
    for(let r=0;r<restarts;r++) {
      const shuffled=[...active];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
      let offset=0;const teams=sizes.map(n=>{const t=shuffled.slice(offset,offset+n);offset+=n;return t;});
      let score=cost(teams);
      if(score<bestCost){best=clone(teams);bestCost=score;}
      if(teams.length===1) break;
      for(let s=0;s<steps;s++) {
        const a=Math.floor(random()*teams.length), b=Math.floor(random()*teams.length);if(a===b)continue;
        const i=Math.floor(random()*teams[a].length),j=Math.floor(random()*teams[b].length);
        const moves=[[i,j]];
        // A required friend pair must be able to move together, including into a duo.
        if(random()<.12) moves.push([(i+1+Math.floor(random()*(teams[a].length-1)))%teams[a].length,(j+1+Math.floor(random()*(teams[b].length-1)))%teams[b].length]);
        for(const [ai,bj] of moves)[teams[a][ai],teams[b][bj]]=[teams[b][bj],teams[a][ai]];
        const next=cost(teams), temperature= Math.max(.15,1200*(1-s/steps)**4);
        if(next<score||random()<Math.exp((score-next)/temperature))score=next;
        else for(const [ai,bj] of moves)[teams[a][ai],teams[b][bj]]=[teams[b][bj],teams[a][ai]];
        if(score<bestCost){best=clone(teams);bestCost=score;}
      }
    }
    return {id:'draft-'+Date.now().toString(36)+'-'+Math.floor(random()*1e9).toString(36),builtAt:new Date().toISOString(),teams:best};
  }
  function confirmMatch(state,roster) {
    if(!state.draft)throw Error('先にチーム案を作成してください。');
    if(state.history.some(h=>h.id===state.draft.id))throw Error('このマッチは確定済みです。');
    const report=analyze(state.draft.teams,roster,state);
    if(!report.valid)throw Error(report.issues.join('\n'));
    const next=clone(state),scores={};
    for(const id of state.draft.teams.flat())scores[id]={rating:effectiveRating(state.members[id]),igl:state.members[id].igl,provisional:state.members[id].rating===null,rank:state.members[id].rank};
    next.history.push({id:state.draft.id,confirmedAt:new Date().toISOString(),teams:clone(state.draft.teams),scores,ratingScale:10});
    return next;
  }
  function swap(teams,a,b) {
    const next=clone(teams);let pa,pb;
    next.forEach((t,ti)=>t.forEach((id,i)=>{if(id===a)pa=[ti,i];if(id===b)pb=[ti,i];}));
    if(!pa||!pb||pa[0]===pb[0])throw Error('別のチームのメンバーを選択してください。');
    [next[pa[0]][pa[1]],next[pb[0]][pb[1]]]=[next[pb[0]][pb[1]],next[pa[0]][pa[1]]];return next;
  }
  return {createState,validateState,migrateV1,migrateV2,capacities,analyze,generate,confirmMatch,swap,pairCounts,pairKey,effectiveRating,pastTeamSeasons,sameOrganization,ranks,rankRating,clone};
});
