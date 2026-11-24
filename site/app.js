(() => {
  'use strict';
  const C=window.LTKCore, roster=window.LTK_ROSTER.players.map(p=>({...p,ltkHistory:window.LTK_RELATIONS?.memberships[p.id]||[]})), byId=Object.fromEntries(roster.map(p=>[p.id,p]));
  const research=Object.fromEntries((window.LTK_RESEARCH?.players||[]).map(p=>[p.id,p]));
  const KEY='ltk4-apex-team-builder:v3', LEGACY_KEYS=['ltk4-apex-team-builder:v2','ltk4-apex-team-builder:v1'], GATE_KEY='ltk4-apex-gate:v1';
  const PASSWORD_HASH='ee4f109c4de68598c497932cdb93f86367ce64a33e5ae93b397e71022e8953bb';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=n=>`<svg class="icon" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const avatar=(id,cls='avatar')=>`<img class="${cls}" src="${byId[id].avatar}" alt="" loading="lazy" width="40" height="40">`;
  const tag=id=>`<span class="team-tag org-${byId[id].team}"><i class="dot"></i>${byId[id].team}</span>`;
  const labelSocial={none:'特に指定なし',prefer:'できれば一緒',required:'知り合いが必要'};
  const labelIgl={yes:'あり',no:'なし',unknown:'未確認'};
  const rankOptions=selected=>Object.entries(C.ranks).map(([key,label])=>`<option value="${key}"${selected===key?' selected':''}>${label}</option>`).join('');
  const rankBadge=(rank='unknown')=>`<span class="rank-badge rank-${rank}">${rank!=='unknown'?`<img src="assets/ranks/${rank}.png" alt="" width="40" height="40">`:''}<span>${C.ranks[rank]||C.ranks.unknown}</span></span>`;
  const proBadge=id=>research[id]?.formerApexPro?'<span class="pro-badge">元APEXプロ</span>':'';
  const dateText=s=>new Date(s).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  let state=C.createState(roster,research), view='teams', search='', filterTeam='', filterAttendance='', undo=[], selected=null, editing=null, friendDraft=new Set(), toastTimer, saveError='';
  let restoreError='',pendingLegacy=null;
  try { const saved=localStorage.getItem(KEY);if(saved)state=C.validateState(JSON.parse(saved),roster);else{for(const key of LEGACY_KEYS){const old=localStorage.getItem(key);if(old){pendingLegacy=JSON.parse(old);break;}}} }catch(e){restoreError='保存データを読み込めません。元データは保持しています。';saveError=restoreError;}
  function save(){
    if(restoreError){$('#save-warning').hidden=false;$('#save-warning').textContent=restoreError;$('#save-state').textContent='保存データの確認が必要';return;}
    try{localStorage.setItem(KEY,JSON.stringify(state));saveError='';$('#save-state').textContent='このブラウザに保存済み';$('#save-warning').hidden=true;}
    catch(e){saveError='ブラウザに保存できません。画面を閉じる前に「設定を書き出す」で保存してください。';$('#save-warning').hidden=false;$('#save-warning').textContent=saveError;$('#save-state').textContent='保存できませんでした';}
  }
  function checkpoint(){undo.push(C.clone(state));if(undo.length>25)undo.shift();}
  function mutate(fn){checkpoint();fn();save();render();}
  function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
  function message(title,text){$('#message-title').textContent=title;$('#message-body').replaceChildren();const p=document.createElement('p');p.textContent=text;$('#message-body').append(p);$('#message-dialog').showModal();}
  function confirmAction(title,text,action,button='実行する'){
    $('#confirm-title').textContent=title;$('#confirm-body').replaceChildren();const p=document.createElement('p');p.textContent=text;$('#confirm-body').append(p);$('#confirm-yes').textContent=button;
    $('#confirm-cancel').textContent='キャンセル';
    $('#confirm-yes').onclick=()=>{$('#confirm-dialog').close();action();};$('#confirm-dialog').showModal();
  }
  function active(){return roster.filter(p=>state.members[p.id].attending);}
  function confirmed(){return !!state.draft&&state.history.some(h=>h.id===state.draft.id);}
  function boardMembers(){
    const h=state.draft&&state.history.find(h=>h.id===state.draft.id);if(!h)return state.members;
    return Object.fromEntries(roster.map(p=>{const s=h.scores[p.id];return [p.id,{...state.members[p.id],attending:!!s,rank:s?.rank||'unknown',rating:s?s.rating:null,_provisional:s?.provisional||false,igl:s?s.igl:'unknown',social:'none',friends:[]}];}));
  }
  function report(){
    if(!state.draft)return null;
    const base=confirmed()?{...state,members:boardMembers(),history:state.history.filter(h=>h.id!==state.draft.id)}:state;
    return C.analyze(state.draft.teams,roster,base);
  }
  function render(){
    const pages={teams:['チーム編成','','チーム編成'],members:['メンバー管理','','メンバー管理'],relations:['関係性の設定','','関係性の設定'],history:['マッチ履歴','','マッチ履歴']};
    const page=pages[view], a=active(),igl=a.filter(p=>state.members[p.id].igl==='yes').length;
    $('#page-title').textContent=page[0];$('#page-subtitle').textContent='';$('#page-subtitle').hidden=true;$('#breadcrumb').innerHTML='WORKSPACE <span>/</span> '+page[2];
    $$('.nav').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
    $('#history-count').textContent=state.history.length;
    let teamCount=0;try{teamCount=C.capacities(a.length).length;}catch(e){}
    const stats=[['users','出席メンバー',a.length,'/ 60人'],['grid','編成チーム数',teamCount,'チーム'],['crown','IGL適性あり',igl,'人'],['history','確定したマッチ',state.history.length,'試合']];
    $('#summary').innerHTML=stats.map(([i,l,v,u])=>`<div class="stat"><span class="stat-icon">${icon(i)}</span><div><span class="stat-label">${l}</span><span class="stat-value">${v}<small>${u}</small></span></div></div>`).join('');
    if(saveError){$('#save-warning').hidden=false;$('#save-warning').textContent=saveError;}
    if(view==='teams')renderTeams();else if(view==='members')renderMembers();else if(view==='relations')renderRelations();else renderHistory();
  }
  function renderTeams(){
    const d=state.draft,r=report(),done=confirmed(),provisional=active().filter(p=>state.members[p.id].rating===null).length,displayMembers=boardMembers();
    const h=done?state.history.find(h=>h.id===d.id):null;
    const actions=`${undo.length?`<button data-action="undo">${icon('undo')}元に戻す</button>`:''}${d?`<button data-action="copy">${icon('copy')}チームをコピー</button>`:''}${done?`<button class="primary" data-action="next">次のマッチを編成</button>`:`<button class="primary" data-action="generate">${icon('shuffle')}${d?'再編成':'自動チーム分け'}</button>`}`;
    let html=`<div class="toolbar"><div class="toolbar-title"><h2>チームボード</h2><span class="match-label">MATCH ${done?state.history.length:state.history.length+1}</span></div><div class="toolbar-actions">${actions}</div></div>`;
    html+=`<div class="settings-row panel">${[['sameTeam','LTK4同チーム'],['pastTeam','過去LTK同チーム'],['sameOrganization','同じ所属組織'],['repeat','当日の同ペアを減らす']].map(([k,l])=>`<label><input type="checkbox" data-setting="${k}" ${state.settings[k]?'checked':''}>${l}</label>`).join('')}</div>`;

    if(!d){
      html+=`<div class="empty-board panel"><div class="avatar-stack">${['yufuna','yukio','shaka','k4sen','kinako','aster-leda'].map(id=>avatar(id,'')).join('')}</div><button class="primary" data-action="generate">${icon('shuffle')}自動チーム分け</button></div>`;
    }else{
      if(done)html+=`<div class="notice good">確定済み</div>`;
      if(!r.valid)html+=`<div class="notice danger"><strong>要調整</strong><br>${r.issues.slice(0,12).map(esc).join('<br>')}${r.issues.length>12?'<br>ほか '+(r.issues.length-12)+'件':''}</div>`;
      html+=`<div class="match-metrics"><span>IGLあり <strong>${r.iglTeams} / ${d.teams.length}</strong></span><span>ペア重複 <strong>${r.repeats}回</strong></span></div>`;
      html+=`<div class="team-grid">${d.teams.map((team,i)=>{const x=r.details[i];return `<article class="team-card ${x.unmet.length?'issue':''}"><header class="team-head"><h3>TEAM ${String(i+1).padStart(2,'0')}${team.length===2?'<span class="duo-label">2人</span>':''}</h3></header><div class="team-members">${team.map(id=>{const p=byId[id],m=displayMembers[id];return `<button class="team-member ${selected===id?'selected':''}" data-select="${id}" ${done?'disabled':''} aria-label="${esc(p.name)}を選択" aria-pressed="${selected===id}">${avatar(id)}<span class="person"><strong>${esc(p.name)}</strong><small>${tag(id)}${proBadge(id)}${m.organization?`<span class="org-badge">${esc(m.organization)}</span>`:''}${m.igl==='yes'?`<span class="igl-badge">${icon('crown')}IGL</span>`:''}${x.unmet.includes(id)?'<span class="bad">条件未達</span>':''}</small></span>${rankBadge(m.rank)}</button>`;}).join('')}</div><footer class="team-foot"><span>IGL ${x.igl}人${x.unknownIgl?' · 未確認'+x.unknownIgl+'人':''}</span><span>${x.pastTeamPairs?'過去LTK '+x.pastTeamPairs+'組 · ':''}${x.organizationPairs?'同組織 '+x.organizationPairs+'組 · ':''}重複 ${x.repeats}回</span></footer></article>`;}).join('')}</div>`;
      if(!done)html+=`<div class="toolbar" style="margin-top:24px"><span></span><button class="primary" data-action="confirm" ${!r.valid?'disabled':''}>${icon('check')}このマッチを確定</button></div>`;
      if(selected)html+=`<div class="swap-bar"><span>${esc(byId[selected].name)} · 交換相手を選択</span><button data-action="cancel-swap">解除</button></div>`;
    }
    $('#view-content').innerHTML=html;
  }
  function filterControls(kind){return `<div class="filter-row"><label class="search-field">${icon('search')}<input id="member-search" type="search" placeholder="名前で検索" aria-label="名前で検索" value="${esc(search)}"></label><select id="team-filter" aria-label="所属で絞り込み"><option value="">すべての所属</option>${window.LTK_ROSTER.teams.map(t=>`<option value="${t.id}" ${filterTeam===t.id?'selected':''}>${t.id} · ${esc(t.name)}</option>`).join('')}</select><select id="attendance-filter" aria-label="出欠で絞り込み"><option value="">出席・欠席すべて</option><option value="yes" ${filterAttendance==='yes'?'selected':''}>出席のみ</option><option value="no" ${filterAttendance==='no'?'selected':''}>欠席のみ</option></select><span id="filtered-count"></span></div><div id="${kind}-results"></div>`;}
  function filtered(){const q=search.trim().toLocaleLowerCase();return roster.filter(p=>(!q||p.name.toLocaleLowerCase().includes(q)||p.id.includes(q)||state.members[p.id].organization.toLocaleLowerCase().includes(q))&&(!filterTeam||p.team===filterTeam)&&(!filterAttendance||(state.members[p.id].attending===(filterAttendance==='yes'))));}
  function renderMembers(){
    $('#view-content').innerHTML=`<div class="toolbar"><div class="toolbar-title"><h2>メンバー</h2></div><div class="toolbar-actions">${undo.length?`<button data-action="undo">${icon('undo')}元に戻す</button>`:''}<button data-action="research-list">調査一覧</button><button data-action="apply-research">調査値を反映</button><button data-action="all-present">全員出席</button><button data-action="all-absent">全員欠席</button></div></div>${filterControls('member')}`;
    renderMemberRows();
  }
  function renderMemberRows(){
    const list=filtered();$('#filtered-count').textContent=list.length+'人';
    $('#member-results').innerHTML=`<div class="member-table panel"><div class="member-table-head"><span>メンバー</span><span>所属</span><span>APEXランク</span><span>IGL適性</span><span>出欠</span><span>詳細</span></div>${list.length?list.map(p=>{const m=state.members[p.id],r=research[p.id];return `<div class="member-row ${!m.attending?'absent':''}"><div class="member-profile">${avatar(p.id)}<div><strong>${esc(p.name)}</strong><small>${esc(p.tier)} · ${esc(p.role)}</small></div></div><div>${tag(p.id)}<small class="member-organization">${esc(m.organization||'未設定')}</small></div><div><div class="rank-editor">${rankBadge(m.rank)}<select data-rank="${p.id}" aria-label="${esc(p.name)}のAPEXランク">${rankOptions(m.rank)}</select></div>${proBadge(p.id)}</div><select data-igl="${p.id}" aria-label="${esc(p.name)}のIGL適性">${['unknown','yes','no'].map(v=>`<option value="${v}" ${m.igl===v?'selected':''}>${labelIgl[v]}</option>`).join('')}</select><label class="attend-label"><input type="checkbox" data-attend="${p.id}" ${m.attending?'checked':''} aria-label="${esc(p.name)}の出席">${m.attending?'出席':'欠席'}</label><button class="edit-button" data-edit="${p.id}" aria-label="${esc(p.name)}の詳細を編集">編集</button></div>`;}).join(''):'<p class="list-empty">該当なし</p>'}</div>`;
  }
  function renderRelations(){
    $('#view-content').innerHTML=`<div class="toolbar"><h2>関係性</h2>${undo.length?`<button data-action="undo">${icon('undo')}元に戻す</button>`:''}</div>${filterControls('relation')}`;renderRelationRows();
  }
  function renderRelationRows(){
    const list=filtered();$('#filtered-count').textContent=list.length+'人';
    $('#relation-results').innerHTML=`<div class="relation-grid">${list.map(p=>{const m=state.members[p.id];return `<article class="relation-card panel"><div class="member-profile">${avatar(p.id)}<div><strong>${esc(p.name)}</strong>${tag(p.id)}</div></div><span class="relation-condition ${m.social}">${labelSocial[m.social]}</span><p class="relation-org">所属組織：${esc(m.organization||'未設定')}</p><div class="ltk-history">${p.ltkHistory.map(h=>`<span>LTK${h.season} ${esc(h.team)} · ${esc(h.tier)}</span>`).join('')}</div><div class="mini-friends">${m.friends.slice(0,6).map(id=>`<img src="${byId[id].avatar}" alt="${esc(byId[id].name)}" title="${esc(byId[id].name)}" loading="lazy">`).join('')}<span>同チーム候補 ${m.friends.length}人</span></div>${m.social==='required'&&!m.friends.some(id=>state.members[id].attending)?'<p class="error-text">出席する候補なし</p>':''}<button data-edit="${p.id}" aria-label="${esc(p.name)}の関係性を編集">${icon('sliders')}編集</button></article>`;}).join('')}</div>${!list.length?'<p class="list-empty">該当なし</p>':''}`;
  }
  function renderHistory(){
    $('#view-content').innerHTML=`<div class="toolbar"><h2>確定マッチ</h2><div class="toolbar-actions">${undo.length?`<button data-action="undo">${icon('undo')}元に戻す</button>`:''}${state.history.length?'<button data-action="new-event">履歴をリセット</button>':''}</div></div>${state.history.length?[...state.history].reverse().map((h,ri)=>`<article class="history-item panel"><header class="history-header"><h2>MATCH ${state.history.length-ri}</h2><small>${esc(dateText(h.confirmedAt))}</small></header><div class="history-grid">${h.teams.map((t,i)=>`<div class="history-team"><strong>TEAM ${String(i+1).padStart(2,'0')}</strong>${t.map(id=>`<span class="history-person">${esc(byId[id].name)}${rankBadge(h.scores[id].rank)}</span>`).join('')}<small>IGL ${t.filter(id=>h.scores[id].igl==='yes').length}人</small></div>`).join('')}</div></article>`).join(''):'<div class="empty-board panel"><h2>履歴なし</h2><button data-view="teams">チーム編成</button></div>'}`;
  }
  function openEditor(id){
    editing=id;friendDraft=new Set(state.members[id].friends);const p=byId[id],m=state.members[id];
    $('#editor-profile').innerHTML=`<div class="member-profile">${avatar(id)}<div><strong>${esc(p.name)}</strong>${tag(id)}</div></div>`;
    $('#edit-rank').innerHTML=rankOptions(m.rank);$('#edit-rank-icon').innerHTML=rankBadge(m.rank);$('#edit-igl').value=m.igl;$('#edit-social').value=m.social;$('#edit-note').value=m.note;$('#edit-organization').value=m.organization;$('#research-info').innerHTML=researchHTML(id);$('#friend-search').value='';renderFriendList();$('#editor').showModal();
  }
  function sourceLinks(sources){return (sources||[]).map(s=>/^https:\/\//.test(s.url||'')?`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title||s.url)}</a>${s.date?` <small>${esc(s.date)}</small>`:''}</li>`:`<li>${esc(s.title||'ユーザー指定')}</li>`).join('');}
  function researchHTML(id){
    const r=research[id],p=byId[id];
    return `<h3>公開情報の調査</h3>${r?`<dl class="research-facts"><dt>到達ランク</dt><dd>${rankBadge(r.rank)}${proBadge(id)}</dd><dt>根拠の確度</dt><dd>${({high:'高',medium:'中',low:'低',unknown:'未確認'})[r.confidence]||'未確認'}</dd><dt>実績・時期</dt><dd>${esc(r.rankLabel||'未確認')}${r.rankPeriod?' · '+esc(r.rankPeriod):''}</dd><dt>IGL</dt><dd>${labelIgl[r.igl]||'未確認'}${r.iglBasis?' · '+esc(r.iglBasis):''}</dd><dt>所属情報</dt><dd>${esc(r.organization||'未確認')}${r.organizationStatus==='former'?'（過去）':''}</dd></dl><details><summary>出典</summary><ul class="source-links">${sourceLinks(r.evidence)}${sourceLinks(r.organizationsEvidence)}</ul></details>`:'<p>未調査</p>'}<h3>LTK参加歴</h3><div class="ltk-history">${p.ltkHistory.map(h=>`<span>LTK${h.season} ${esc(h.team)} · ${esc(h.tier)}</span>`).join('')}</div>`;
  }
  function relatedText(a,b){const seasons=C.pastTeamSeasons(byId[a],byId[b]),sameOrg=C.sameOrganization(state.members[a],state.members[b]);return [seasons.length?'LTK'+seasons.join('/'):'',sameOrg?state.members[a].organization:''].filter(Boolean).join(' · ');}
  function renderFriendList(){
    const q=$('#friend-search').value.trim().toLocaleLowerCase();
    $('#friend-list').innerHTML=roster.filter(p=>p.id!==editing&&(!q||p.name.toLocaleLowerCase().includes(q)||p.id.includes(q))).map(p=>`<label class="friend-option"><input type="checkbox" data-friend="${p.id}" ${friendDraft.has(p.id)?'checked':''}><img src="${p.avatar}" alt="" loading="lazy"><span>${esc(p.name)}<small>${esc(relatedText(editing,p.id))}</small></span></label>`).join('');$('#friend-count').textContent=friendDraft.size+'人';
  }
  function applyResearch(target,replaceRatings=false){
    for(const p of roster){const m=target.members[p.id],r=research[p.id];if(!r)continue;
      if((m.rating===null||replaceRatings)&&r.rating!=null)m.rating=r.rating;
      if(m.rank==='unknown'&&r.rank!=='unknown')m.rank=r.rank;
      if(!m.organization&&r.organizationStatus==='verified')m.organization=r.organization||'';
      if(m.igl==='unknown'&&r.igl==='yes')m.igl='yes';
    }
    return target;
  }
  function showResearch(){
    $('#message-title').textContent='60人の調査結果';
    $('#message-body').innerHTML=`<div class="research-summary">調査日 ${esc(window.LTK_RESEARCH?.checkedAt||'')} · ランク確認 ${Object.values(research).filter(r=>r.rank!=='unknown').length}人</div><div class="research-table">${roster.map(p=>{const r=research[p.id]||{};return `<article><strong>${esc(p.name)} ${proBadge(p.id)}</strong>${rankBadge(r.rank)}<p>${esc(r.rankLabel||'未確認')}</p><small>${esc(r.rankPeriod||'時期未確認')} · ${esc(r.organization||'所属未確認')}</small><ul class="source-links">${sourceLinks(r.evidence)}</ul></article>`;}).join('')}</div>`;
    $('#message-dialog').showModal();
  }
  function selectMember(id){
    if(confirmed())return;
    if(!selected){selected=id;renderTeams();return;}
    if(selected===id){selected=null;renderTeams();return;}
    const a=selected;
    try{const teams=C.swap(state.draft.teams,a,id);mutate(()=>state.draft.teams=teams);selected=null;renderTeams();toast(byId[a].name+'さんと'+byId[id].name+'さんを交換しました');}
    catch(e){toast(e.message);}
  }
  function generate(){
    const run=()=>{$('#view-content').classList.add('busy');const buttons=$$('[data-action="generate"], [data-action="next"]');buttons.forEach(b=>{b.disabled=true;b.textContent='組み合わせを検討中…';});
      setTimeout(()=>{try{const draft=C.generate(roster,state);mutate(()=>{state.draft=draft;selected=null;});const r=report();if(!r.valid)message('条件を満たす案が見つかりませんでした',r.issues.join('\n')+'\n\n相手候補を増やすか、手動交換・再編成で調整してください。必須条件は解除していません。');else toast('チーム案を作成しました。手動で調整できます。');}catch(e){message('チーム分けを確認してください',e.message);render();}finally{$('#view-content').classList.remove('busy');}},40);
    };
    if(state.draft&&!confirmed())confirmAction('現在のチーム案を組み直しますか？','手動調整した現在案を新しい編成に置き換えます。「元に戻す」で戻せます。',run,'組み直す');else run();
  }
  function exportState(){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='LTK4-APEX-settings-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('設定ファイルを書き出しました');
  }
  function copyTeams(){
    const text=state.draft.teams.map((t,i)=>'TEAM '+String(i+1).padStart(2,'0')+'\n'+t.map(id=>byId[id].name).join(' / ')).join('\n\n');
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>toast('チーム一覧をコピーしました')).catch(()=>message('チーム一覧',text));else message('チーム一覧',text);
  }
  const actions={generate,undo:()=>{if(!undo.length)return;state=undo.pop();selected=null;save();render();toast('ひとつ前の状態に戻しました');},'cancel-swap':()=>{selected=null;renderTeams();},copy:copyTeams,confirm:()=>{if(confirmed())return;confirmAction('この編成でマッチを確定しますか？','実際に使うチームだけを確定してください。次の編成から同じペアの回数に反映します。',()=>{try{mutate(()=>state=C.confirmMatch(state,roster));toast('マッチを確定して履歴に記録しました');}catch(e){message('確定できません',e.message);}},'マッチを確定');},next:generate,'all-present':()=>confirmAction('全員を出席にしますか？','60人すべてを出席に変更します。',()=>mutate(()=>roster.forEach(p=>state.members[p.id].attending=true))),'all-absent':()=>confirmAction('全員を欠席にしますか？','その後、参加する人だけ出席にできます。',()=>mutate(()=>roster.forEach(p=>state.members[p.id].attending=false))),'new-event':()=>confirmAction('当日の履歴をリセットしますか？','履歴と現在のチーム案をリセットします。ランク・IGL・関係性・出欠は残ります。必要なら先に設定を書き出してください。元に戻す操作も可能です。',()=>mutate(()=>{state.history=[];state.draft=null;selected=null;}),'履歴をリセット')};
  actions['research-list']=showResearch;
  actions['apply-research']=()=>confirmAction('調査値を反映しますか？','未確認・未設定の項目だけを補完します。設定済みのランクは保持します。',()=>{mutate(()=>applyResearch(state));toast('調査値を反映しました');},'反映する');
  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.view){view=b.dataset.view;selected=null;search='';filterTeam='';filterAttendance='';render();window.scrollTo({top:0,behavior:'instant'});}
    if(b.dataset.action)actions[b.dataset.action]?.();
    if(b.dataset.edit)openEditor(b.dataset.edit);
    if(b.dataset.select)selectMember(b.dataset.select);
    if(b.dataset.close)document.getElementById(b.dataset.close).close();
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.dataset.attend)mutate(()=>state.members[el.dataset.attend].attending=el.checked);
    if(el.dataset.rank)mutate(()=>{const m=state.members[el.dataset.rank];m.rank=el.value;m.rating=C.rankRating(el.value,research[el.dataset.rank]);});
    if(el.id==='edit-rank')$('#edit-rank-icon').innerHTML=rankBadge(el.value);
    if(el.dataset.igl)mutate(()=>state.members[el.dataset.igl].igl=el.value);
    if(el.dataset.setting)mutate(()=>state.settings[el.dataset.setting]=el.checked);
    if(el.id==='team-filter'){filterTeam=el.value;view==='members'?renderMemberRows():renderRelationRows();}
    if(el.id==='attendance-filter'){filterAttendance=el.value;view==='members'?renderMemberRows():renderRelationRows();}
    if(el.dataset.friend){el.checked?friendDraft.add(el.dataset.friend):friendDraft.delete(el.dataset.friend);$('#friend-count').textContent=friendDraft.size+'人を指定';}
  });
  document.addEventListener('input',event=>{if(event.target.id==='member-search'){search=event.target.value;view==='members'?renderMemberRows():renderRelationRows();}if(event.target.id==='friend-search')renderFriendList();});
  $('#add-affiliation').onclick=()=>{roster.filter(p=>p.id!==editing&&p.team===byId[editing].team).forEach(p=>friendDraft.add(p.id));renderFriendList();};
  $('#add-past-team').onclick=()=>{roster.filter(p=>p.id!==editing&&C.pastTeamSeasons(byId[editing],p).length).forEach(p=>friendDraft.add(p.id));renderFriendList();};
  $('#add-organization').onclick=()=>{const org=$('#edit-organization').value.trim();roster.filter(p=>p.id!==editing&&C.sameOrganization({organization:org},state.members[p.id])).forEach(p=>friendDraft.add(p.id));renderFriendList();};
  $('#editor-form').onsubmit=event=>{event.preventDefault();const social=$('#edit-social').value;if(social==='required'&&!friendDraft.size){toast('同チーム候補を1人以上選択してください');return;}mutate(()=>{Object.assign(state.members[editing],{rank:$('#edit-rank').value,rating:$('#edit-rank').value===state.members[editing].rank?state.members[editing].rating:C.rankRating($('#edit-rank').value,research[editing]),igl:$('#edit-igl').value,social,friends:[...friendDraft],note:$('#edit-note').value,organization:$('#edit-organization').value.trim()});});$('#editor').close();toast('保存しました');};
  $('#export').onclick=exportState;$('#import').onclick=()=>$('#import-file').click();
  $('#import-file').onchange=async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    if(file.size>8*1024*1024){message('読み込めません','設定ファイルは8MB以内にしてください。');return;}
    try{const raw=JSON.parse(await file.text());if([1,2].includes(raw.version)){offerMigration(raw);return;}const next=C.validateState(raw,roster);confirmAction('設定ファイルを読み込みますか？','現在の設定をファイルの内容に置き換えます。元に戻す操作が可能です。',()=>{checkpoint();state=next;restoreError='';selected=null;save();render();toast('読み込みました');},'読み込む');}catch(e){message('設定ファイルを読み込めません',e.message);}
  };
  $('#confirm-cancel').onclick=()=>$('#confirm-dialog').close();
  $('#help-open').onclick=()=>message('使い方・設定の受け渡し','1. メンバー管理で出席者とAPEXランク・IGLを設定します。\n2. 関係性の設定で、必要な人に知り合いを指定します。\n3. 自動編成し、必要なら2人を選んで交換します。\n4. 実際に使う編成を確定してから、次のマッチを作ります。\n\n設定はこのブラウザに保存されます。自動同期はしません。「設定を書き出す」でJSONファイルを渡し、相手が「読み込む」を使うと引き継げます。\n同時に別々に編集した内容の自動結合はありません。\n\nこのパスワードは簡易ロックです。サイトの内容を暗号化したり、閲覧者を厳密に限定するものではありません。');
  $('#lock').onclick=()=>{try{sessionStorage.removeItem(GATE_KEY);}catch(e){}$('#app').hidden=true;$('#gate').hidden=false;$('#password').value='';$('#password').focus();};
  $('#help-top').onclick=$('#help-open').onclick;$('#lock-top').onclick=$('#lock').onclick;
  $('#show-password').onclick=()=>{const el=$('#password');el.type=el.type==='password'?'text':'password';$('#show-password').textContent=el.type==='password'?'表示':'隠す';};
  $('#login-form').onsubmit=async event=>{event.preventDefault();try{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode($('#password').value)),hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==PASSWORD_HASH){$('#login-error').textContent='パスワードが違います。';return;}try{sessionStorage.setItem(GATE_KEY,PASSWORD_HASH);}catch(e){}unlock();}catch(e){$('#login-error').textContent='HTTPSの公開URLまたはローカルプレビューから開いてください。';}};
  function offerMigration(raw){
    const next=raw.version===2?C.migrateV2(raw,roster):C.migrateV1(raw,roster);
    for(const p of roster)next.members[p.id].rank=research[p.id]?.rank||'unknown';
    confirmAction('ランク表示版に移行しますか？','出欠・関係性・履歴を引き継ぎ、調査済みの到達ランクを反映します。元の保存データは残ります。',()=>{const replace=$('#migration-research').checked;mutate(()=>{state=replace?applyResearch(next,true):next;restoreError='';selected=null;});toast('移行しました');},'移行する');
    const label=document.createElement('label');label.className='migration-choice';const input=document.createElement('input');input.type='checkbox';input.id='migration-research';input.checked=true;label.append(input,document.createTextNode('編成用の内部設定を調査データで更新'));$('#confirm-body').append(label);$('#confirm-cancel').textContent='移行しない';
  }
  function unlock(){$('#gate').hidden=true;$('#app').hidden=false;$('#password').value='';$('#login-error').textContent='';render();if(pendingLegacy){const raw=pendingLegacy;pendingLegacy=null;try{offerMigration(raw);}catch(e){message('移行できません',e.message);}}}
  window.addEventListener('storage',event=>{if(event.key===KEY&&event.newValue)toast('別タブで設定が更新されました。必要な設定を書き出してから再読み込みしてください。');});
  try{if(sessionStorage.getItem(GATE_KEY)===PASSWORD_HASH)unlock();}catch(e){}
})();

