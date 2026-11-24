const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../site/core.js');const ctx={window:{}};vm.runInNewContext(fs.readFileSync(require('node:path').resolve(__dirname,'../site/roster.js'),'utf8'),ctx);
const roster=JSON.parse(JSON.stringify(ctx.window.LTK_ROSTER.players));
function fixture(n=60){const s=C.createState(roster);roster.forEach((p,i)=>{s.members[p.id].attending=i<n;s.members[p.id].rating=i%10+1;});return s;}
const quick={seed:420,iterations:6000,restarts:3};
test('public roster has exactly 60 unique IDs, four affiliations and valid local portraits',()=>{
 assert.equal(roster.length,60);assert.equal(new Set(roster.map(p=>p.id)).size,60);assert.equal(new Set(roster.map(p=>p.team)).size,4);
 for(const p of roster)assert.ok(fs.statSync(require('node:path').resolve(__dirname,'../site',p.avatar)).size>100);
});
test('all supported attendance counts produce only duos or trios with no one left out',()=>{
 for(let n=2;n<=60;n++){const sizes=C.capacities(n);assert.equal(sizes.reduce((a,b)=>a+b,0),n);assert.ok(sizes.every(x=>x===2||x===3));assert.ok(sizes.length<=20);}
 assert.throws(()=>C.capacities(1));assert.throws(()=>C.capacities(61));
});
test('60 varied players are assigned once, absentees excluded, totals reasonably balanced',()=>{
 const s=fixture();const d=C.generate(roster,s,quick),r=C.analyze(d.teams,roster,s);assert.ok(r.valid);assert.equal(d.teams.length,20);assert.equal(new Set(d.teams.flat()).size,60);assert.ok(r.range<=3,'point spread '+r.range);
});
test('58 attendees yield 18 trios and 2 duos, 59 yield 19 trios and 1 duo',()=>{
 for(const n of [58,59]){const s=fixture(n),d=C.generate(roster,s,{...quick,iterations:1500});assert.equal(d.teams.filter(t=>t.length===2).length,n===58?2:1);assert.ok(C.analyze(d.teams,roster,s).valid);}
});
test('two and four attendees can be allocated without a solo',()=>{
 for(const n of [2,4]){const s=fixture(n),d=C.generate(roster,s,quick);assert.deepEqual(d.teams.map(t=>t.length),n===2?[2]:[2,2]);assert.ok(C.analyze(d.teams,roster,s).valid);}
});
test('required familiarity is respected for directional friend requirements',()=>{
 const s=fixture(12),a=roster[0].id,b=roster[7].id;s.members[a].social='required';s.members[a].friends=[b];
 const d=C.generate(roster,s,quick);assert.ok(d.teams.some(t=>t.includes(a)&&t.includes(b)));assert.ok(C.analyze(d.teams,roster,s).valid);
});
test('missing attending friends block generation with an explanatory message',()=>{
 const s=fixture(6),a=roster[0].id;s.members[a].social='required';s.members[a].friends=[roster[10].id];assert.throws(()=>C.generate(roster,s,quick),/出席する知り合い候補/);
});
test('IGLs are distributed when one per team is possible',()=>{
 const s=fixture(12);for(let i=0;i<4;i++)s.members[roster[i].id].igl='yes';
 const d=C.generate(roster,s,quick),r=C.analyze(d.teams,roster,s);assert.equal(r.iglTeams,4);
});
test('a required friend pair can move together into a duo to balance the totals',()=>{
 const s=fixture(59);for(const m of Object.values(s.members))m.rating=5;
 const a=roster.find(p=>p.id==='yufuna').id,b=roster.find(p=>p.id==='kanae').id;
 s.members[a].rating=9;s.members[a].social='required';s.members[a].friends=[b];
 const d=C.generate(roster,s,{...quick,iterations:9000});const r=C.analyze(d.teams,roster,s);
 assert.ok(r.valid);assert.ok(r.range<=1,'point spread '+r.range);
 assert.ok(d.teams.some(t=>t.length===2&&t.includes(a)&&t.includes(b)));
});
test('manual swaps preserve attendance and can reveal broken mandatory conditions',()=>{
 const s=fixture(6),ids=roster.slice(0,6).map(p=>p.id);s.members[ids[0]].social='required';s.members[ids[0]].friends=[ids[1]];
 const teams=[ids.slice(0,3),ids.slice(3)];assert.ok(C.analyze(teams,roster,s).valid);
 const changed=C.swap(teams,ids[1],ids[3]);assert.equal(changed.flat().length,6);assert.equal(new Set(changed.flat()).size,6);assert.ok(!C.analyze(changed,roster,s).valid);assert.throws(()=>C.swap(teams,ids[0],ids[1]));assert.deepEqual(teams,[ids.slice(0,3),ids.slice(3)]);
});
test('attendance edits invalidate an existing draft instead of silently omitting a member',()=>{
 const s=fixture(6),d=C.generate(roster,s,quick);s.members[roster[0].id].attending=false;assert.ok(C.analyze(d.teams,roster,s).issues.some(x=>x.includes('欠席')));
});
test('confirmation creates one immutable snapshot, rejects duplicates and unfulfilled conditions',()=>{
 const s=fixture(6);s.draft=C.generate(roster,s,quick);const next=C.confirmMatch(s,roster);assert.equal(s.history.length,0);assert.equal(next.history.length,1);assert.throws(()=>C.confirmMatch(next,roster),/確定済み/);
 const id=roster[0].id,point=next.history[0].scores[id].rating;next.members[id].rating=10;assert.equal(next.history[0].scores[id].rating,point);
 const bad=fixture(6);bad.draft=C.generate(roster,bad,quick);bad.members[id].social='required';bad.members[id].friends=[];assert.throws(()=>C.confirmMatch(bad,roster),/知り合い/);
});
test('confirmed history informs the next match and repeated pairs are reduced',()=>{
 let s=fixture(12);for(const m of Object.values(s.members))m.rating=5;s.settings.sameTeam=false;s.draft=C.generate(roster,s,quick);s=C.confirmMatch(s,roster);s.draft=null;
 const next=C.generate(roster,s,{...quick,seed:123});assert.equal(C.analyze(next.teams,roster,s).repeats,0);assert.equal(s.history.length,1);
});
test('unrated players remain null while provisional 5 points are used in totals',()=>{
 const s=C.createState(roster);for(let i=2;i<60;i++)s.members[roster[i].id].attending=false;const d=C.generate(roster,s,quick),r=C.analyze(d.teams,roster,s);assert.equal(r.totals[0],10);assert.equal(r.provisional,2);assert.equal(s.members[roster[0].id].rating,null);
});
test('JSON round trip retains edits, directed friends, current draft and history',()=>{
 let s=fixture(9);s.members[roster[0].id].note='<script>not markup</script>';s.members[roster[0].id].friends=[roster[1].id];s.draft=C.generate(roster,s,quick);s=C.confirmMatch(s,roster);
 assert.deepEqual(C.validateState(JSON.parse(JSON.stringify(s)),roster),s);
});
test('invalid JSON schema, ratings, unknown friends, duplicate slots and duplicate matches are rejected',()=>{
 const s=fixture(6),id=roster[0].id;
 for(const change of [x=>x.version=2,x=>x.members[id].rating=99,x=>x.members[id].rating='5',x=>x.members[id].friends=['stranger'],x=>x.members[id].friends=[id],x=>x.members[id].note='x'.repeat(501)]){const bad=C.clone(s);change(bad);assert.throws(()=>C.validateState(bad,roster));}
 const bad=C.clone(s);bad.draft={id:'x',builtAt:new Date().toISOString(),teams:[[id,id]]};assert.throws(()=>C.validateState(bad,roster));
 let history=C.clone(s);history.draft=C.generate(roster,history,quick);history=C.confirmMatch(history,roster);history.history.push(C.clone(history.history[0]));assert.throws(()=>C.validateState(history,roster));
});
