(() => {
  'use strict';
  const C=window.LTKCore, roster=window.LTK_ROSTER.players, byId=Object.fromEntries(roster.map(p=>[p.id,p]));
  const KEY='ltk4-apex-team-builder:v1', GATE_KEY='ltk4-apex-gate:v1';
  const PASSWORD_HASH='ee4f109c4de68598c497932cdb93f86367ce64a33e5ae93b397e71022e8953bb';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=n=>`<svg class="icon" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const avatar=(id,cls='avatar')=>`<img class="${cls}" src="${byId[id].avatar}" alt="" loading="lazy" width="40" height="40">`;
  const tag=id=>`<span class="team-tag org-${byId[id].team}"><i class="dot"></i>${byId[id].team}</span>`;
  const labelSocial={none:'特に指定なし',prefer:'できれば一緒',required:'知り合いが必要'};
  const labelIgl={yes:'あり',no:'なし',unknown:'未確認'};
  const ratingOptions=selected=>`<option value=""${selected===null?' selected':''}>未評価 · 仮5</option>`+Array.from({length:10},(_,i)=>`<option value="${i+1}"${selected===i+1?' selected':''}>${i+1} 点</option>`).join('');
  const dateText=s=>new Date(s).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  let state=C.createState(roster), view='teams', search='', filterTeam='', filterAttendance='', undo=[], selected=null, editing=null, friendDraft=new Set(), toastTimer, saveError='';
  let restoreError='';
  try { const saved=localStorage.getItem(KEY);if(saved)state=C.validateState(JSON.parse(saved),roster); }catch(e){restoreError='前回の保存データを読み込めませんでした。元のデータは上書きしていません。設定ファイルがあれば読み込んでください。';saveError=restoreError;}
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
    $('#confirm-yes').onclick=()=>{$('#confirm-dialog').close();action();};$('#confirm-dialog').showModal();
  }
  function active(){return roster.filter(p=>state.members[p.id].attending);}
  function confirmed(){return !!state.draft&&state.history.some(h=>h.id===state.draft.id);}
  function boardMembers(){
    const h=state.draft&&state.history.find(h=>h.id===state.draft.id);if(!h)return state.members;
    return Object.fromEntries(roster.map(p=>{const s=h.scores[p.id];return [p.id,{...state.members[p.id],attending:!!s,rating:s?(s.provisional?null:s.rating):null,igl:s?s.igl:'unknown',social:'none',friends:[]}];}));
  }
  function report(){
    if(!state.draft)return null;
    const base=confirmed()?{...state,members:boardMembers(),history:state.history.filter(h=>h.id!==state.draft.id)}:state;
    return C.analyze(state.draft.teams,roster,base);
  }
  function render(){
    const pages={teams:['本日のチーム編成','戦力と関係性を見ながら、ちょうどいい組み合わせに。','チーム編成'],members:['メンバー管理','出欠・戦力・IGLをまとめて設定。評価はいつでも調整できます。','メンバー管理'],relations:['関係性の設定','「この人がいれば安心」を、一人ひとりに合わせて。','関係性の設定'],history:['マッチ履歴','確定した組み合わせを、次のチーム分けに。','マッチ履歴']};
    const page=pages[view], a=active(),igl=a.filter(p=>state.members[p.id].igl==='yes').length;
    $('#page-title').textContent=page[0];$('#page-subtitle').textContent=page[1];$('#breadcrumb').innerHTML='WORKSPACE <span>/</span> '+page[2];
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
    const actions=`${undo.length?`<button data-action="undo">${icon('undo')}元に戻す</button>`:''}${d?`<button data-action="copy">${icon('copy')}チームをコピー</button>`:''}${done?`<button class="primary" data-action="next">次のマッチを編成</button>`:`<button class="primary" data-action="generate">${icon('shuffle')}${d?'もう一度チーム分け':'自動でチーム分け'}</button>`}`;
    let html=`<div class="toolbar"><div class="toolbar-title"><h2>チームボード</h2><span class="match-label">MATCH ${done?state.history.length:state.history.length+1}</span></div><div class="toolbar-actions">${actions}</div></div>`;
    html+=`<div class="settings-row panel"><label><input type="checkbox" data-setting="sameTeam" ${state.settings.sameTeam?'checked':''}>同じLTK所属を優先</label><label><input type="checkbox" data-setting="repeat" ${state.settings.repeat?'checked':''}>当日の同じペアを減らす</label><span>知り合い必須の設定は、常に優先します</span></div>`;
    if(provisional)html+=`<div class="initial-help panel">${provisional}人が未評価です。編成では<strong>仮5点</strong>として扱います。<button data-view="members">メンバー管理で評価する</button></div>`;
    if(!d){
      const stacks=['yufuna','kanae','shaka','k4sen','kinako','aster-leda'];
      html+=`<div class="empty-board panel"><div class="avatar-stack">${stacks.map(id=>avatar(id,'')).join('')}</div><h2>出席メンバーがそろったら、チーム分け。</h2><p>戦力点・IGL・知り合いの条件を考慮して編成します。<br>作成したチームは、あとから自由に入れ替えられます。</p><button class="primary" data-action="generate">${icon('shuffle')}自動でチーム分け</button></div><div class="how-grid"><div class="how-card panel">${icon('users')}<div><h3>まずは出欠と評価</h3><p>欠席者を外して、戦力を1〜10点で設定。<br>IGL適性も別に設定できます。</p></div></div><div class="how-card panel">${icon('link')}<div><h3>安心できる組み合わせ</h3><p>知り合いが必要な人には、<br>一緒に組める相手を事前に指定。</p></div></div><div class="how-card panel">${icon('history')}<div><h3>試合ごとに、新しいチーム</h3><p>確定したマッチを履歴に残して、<br>同じペアの繰り返しを減らします。</p></div></div></div>`;
    }else{
      if(done)html+=`<div class="notice good">${icon('check')} このマッチは確定済みです。点数・IGLは確定時の設定で表示しています。次の編成には、この組み合わせが履歴として使われます。</div>`;
      if(!r.valid)html+=`<div class="notice danger"><strong>確定前に調整が必要です</strong><br>${r.issues.slice(0,12).map(esc).join('<br>')}${r.issues.length>12?'<br>ほか '+(r.issues.length-12)+'件':''}</div>`;
      html+=`<div class="match-metrics"><span>チーム点差 <strong>${r.range}点</strong></span><span>平均 <strong>${r.average.toFixed(1)}点</strong></span><span>IGLあり <strong>${r.iglTeams} / ${d.teams.length}チーム</strong></span><span>当日のペア重複 <strong>${r.repeats}回</strong></span><span>合計点を基準に編成</span></div>`;
      if(!done)html+=`<p class="edit-mode-banner">入れ替えたいメンバーを選び、別チームのメンバーを選ぶと交換できます。</p>`;
      html+=`<div class="team-grid">${d.teams.map((team,i)=>{const detail=r.details[i];return `<article class="team-card ${detail.unmet.length?'issue':''}"><header class="team-head"><h3>TEAM ${String(i+1).padStart(2,'0')}${team.length===2?'<span class="duo-label">2人</span>':''}</h3><span>${detail.total}<small>pt</small></span></header><div class="team-members">${team.map(id=>{const p=byId[id],m=displayMembers[id];return `<button class="team-member ${selected===id?'selected':''}" data-select="${id}" ${done?'disabled':''} aria-label="${esc(p.name)}を選択" aria-pressed="${selected===id}">${avatar(id)}<span class="person"><strong>${esc(p.name)}</strong><small>${tag(id)}${m.igl==='yes'?`<span class="igl-badge">${icon('crown')}IGL</span>`:''}${detail.unmet.includes(id)?'<span class="bad">知り合い未配置</span>':''}</small></span><span class="points">${C.effectiveRating(m)}<small>${m.rating===null?'仮評価':'pt'}</small></span></button>`;}).join('')}</div><footer class="team-foot"><span>${detail.igl?'IGL '+detail.igl+'人':'IGLなし'}${detail.unknownIgl?' · 未確認'+detail.unknownIgl+'人':''}</span><span class="${detail.repeats?'bad':''}">${detail.repeats?'ペア重複 '+detail.repeats+'回':'ペア重複なし'}</span></footer></article>`;}).join('')}</div>`;
      if(!done)html+=`<div class="toolbar" style="margin-top:24px"><span class="muted" style="font-size:.8rem">調整が終わったら、実際に使う編成を確定してください。</span><button class="primary" data-action="confirm" ${!r.valid?'disabled':''}>${icon('check')}このマッチを確定</button></div>`;
      if(selected)html+=`<div class="swap-bar"><span><strong>${esc(byId[selected].name)}</strong> さんを選択中。交換する相手を選んでください。</span><button data-action="cancel-swap">解除</button></div>`;
    }
    $('#view-content').innerHTML=html;
  }
  function filterControls(kind){return `<div class="filter-row"><label class="search-field">${icon('search')}<input id="member-search" type="search" placeholder="名前で検索" aria-label="名前で検索" value="${esc(search)}"></label><select id="team-filter" aria-label="所属で絞り込み"><option value="">すべての所属</option>${window.LTK_ROSTER.teams.map(t=>`<option value="${t.id}" ${filterTeam===t.id?'selected':''}>${t.id} · ${esc(t.name)}</option>`).join('')}</select><select id="attendance-filter" aria-label="出欠で絞り込み"><option value="">出席・欠席すべて</option><option value="yes" ${filterAttendance==='yes'?'selected':''}>出席のみ</option><option value="no" ${filterAttendance==='no'?'selected':''}>欠席のみ</option></select><span id="filtered-count"></span></div><div id="${kind}-results"></div>`;}
  function filtered(){const q=search.trim().toLocaleLowerCase();return roster.filter(p=>(!q||p.name.toLocaleLowerCase().includes(q)||p.id.includes(q))&&(!filterTeam||p.team===filterTeam)&&(!filterAttendance||(state.members[p.id].attending===(filterAttendance==='yes'))));}
  function renderMembers(){
    $('#view-content').innerHTML=`<div class="toolbar"><div class="toolbar-title"><h2>参加メンバー</h2></div><div class="toolbar-actions">${undo.length?`<button data-action="undo">${icon('undo')}元に戻す</button>`:''}<button data-action="all-present">全員出席</button><button data-action="all-absent">全員欠席</button></div></div><div class="notice">戦力評価は主催者の目安です。未評価は編成時に仮5点、IGLは未確認として扱います。</div>${filterControls('member')}`;
    renderMemberRows();
  }
  function renderMemberRows(){
    const list=filtered();$('#filtered-count').textContent=list.length+'人を表示';
    $('#member-results').innerHTML=`<div class="member-table panel"><div class="member-table-head"><span>メンバー</span><span>LTK所属</span><span>戦力評価</span><span>IGL適性</span><span>出欠</span><span>詳細</span></div>${list.length?list.map(p=>{const m=state.members[p.id];return `<div class="member-row ${!m.attending?'absent':''}"><div class="member-profile">${avatar(p.id)}<div><strong>${esc(p.name)}</strong><small>${esc(p.tier)} · ${esc(p.role)}</small></div></div><div>${tag(p.id)}</div><select data-rating="${p.id}" aria-label="${esc(p.name)}の戦力評価">${ratingOptions(m.rating)}</select><select data-igl="${p.id}" aria-label="${esc(p.name)}のIGL適性">${['unknown','yes','no'].map(v=>`<option value="${v}" ${m.igl===v?'selected':''}>${labelIgl[v]}</option>`).join('')}</select><label class="attend-label"><input type="checkbox" data-attend="${p.id}" ${m.attending?'checked':''} aria-label="${esc(p.name)}の出席">${m.attending?'出席':'欠席'}</label><button class="edit-button" data-edit="${p.id}" aria-label="${esc(p.name)}の詳細を編集">編集</button></div>`;}).join(''):'<p class="list-empty">条件に合うメンバーがいません。</p>'}</div>`;
  }
  function renderRelations(){
    $('#view-content').innerHTML=`<div class="toolbar"><h2>一人ひとりの組みやすさ</h2>${undo.length?`<button data-action="undo">${icon('undo')}元に戻す</button>`:''}</div><div class="notice">「最低1人は必要」にした人は、指定した知り合いのうち少なくとも1人と組ませます。関係性は手動設定を優先し、所属だけで必須条件にはしません。</div>${filterControls('relation')}`;renderRelationRows();
  }
  function renderRelationRows(){
    const list=filtered();$('#filtered-count').textContent=list.length+'人を表示';
    $('#relation-results').innerHTML=`<div class="relation-grid">${list.map(p=>{const m=state.members[p.id];return `<article class="relation-card panel"><div class="member-profile">${avatar(p.id)}<div><strong>${esc(p.name)}</strong>${tag(p.id)}</div></div><span class="relation-condition ${m.social}">${labelSocial[m.social]}</span><div class="mini-friends">${m.friends.slice(0,6).map(id=>`<img src="${byId[id].avatar}" alt="${esc(byId[id].name)}" title="${esc(byId[id].name)}" loading="lazy">`).join('')}<span>${m.friends.length?m.friends.length+'人を指定':'知り合い未設定'}</span></div><p>${m.social==='required'&&!m.friends.some(id=>state.members[id].attending)?'<span class="error-text">出席する知り合い候補がいません</span>':!m.attending?'本日は欠席':m.note?esc(m.note.slice(0,45)):'相手は複数人を指定できます。'}</p><button data-edit="${p.id}" aria-label="${esc(p.name)}の関係性を編集">${icon('sliders')}条件を編集</button></article>`;}).join('')}</div>${!list.length?'<p class="list-empty">条件に合うメンバーがいません。</p>':''}`;
  }
  function renderHistory(){
    $('#view-content').innerHTML=`<div class="toolbar"><h2>確定したマッチ</h2><div class="toolbar-actions">${undo.length?`<button data-action="undo">${icon('undo')}元に戻す</button>`:''}${state.history.length?'<button data-action="new-event">当日の履歴をリセット</button>':''}</div></div>${state.history.length?'<div class="notice">過去マッチの点数・IGLは、確定した時点の設定です。現在の評価を変えても過去の記録は変わりません。</div>':''}${state.history.length?[...state.history].reverse().map((h,ri)=>`<article class="history-item panel"><header class="history-header"><h2>MATCH ${state.history.length-ri}</h2><small>${esc(dateText(h.confirmedAt))} 確定</small></header><div class="history-grid">${h.teams.map((t,i)=>`<div class="history-team"><strong>TEAM ${String(i+1).padStart(2,'0')}</strong>${t.map(id=>`<span>${esc(byId[id].name)}</span>`).join('')}<small>合計 ${t.reduce((s,id)=>s+h.scores[id].rating,0)}pt · IGL ${t.filter(id=>h.scores[id].igl==='yes').length}人</small></div>`).join('')}</div></article>`).join(''):'<div class="empty-board panel">'+icon('history')+'<h2 style="margin-top:16px">確定したマッチが、ここに残ります。</h2><p>チーム編成で「このマッチを確定」を押すと記録されます。<br>試しに作ったチーム案は、履歴には数えません。</p><button data-view="teams">チーム編成に戻る</button></div>'}`;
  }
  function openEditor(id){
    editing=id;friendDraft=new Set(state.members[id].friends);const p=byId[id],m=state.members[id];
    $('#editor-profile').innerHTML=`<div class="member-profile">${avatar(id)}<div><strong>${esc(p.name)}</strong>${tag(id)}</div></div>`;
    $('#edit-rating').innerHTML=ratingOptions(m.rating);$('#edit-igl').value=m.igl;$('#edit-social').value=m.social;$('#edit-note').value=m.note;$('#friend-search').value='';renderFriendList();$('#editor').showModal();
  }
  function renderFriendList(){
    const q=$('#friend-search').value.trim().toLocaleLowerCase();
    $('#friend-list').innerHTML=roster.filter(p=>p.id!==editing&&(!q||p.name.toLocaleLowerCase().includes(q)||p.id.includes(q))).map(p=>`<label class="friend-option"><input type="checkbox" data-friend="${p.id}" ${friendDraft.has(p.id)?'checked':''}><img src="${p.avatar}" alt="" loading="lazy"><span>${esc(p.name)}</span></label>`).join('');$('#friend-count').textContent=friendDraft.size+'人を指定';
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
  const actions={generate,undo:()=>{if(!undo.length)return;state=undo.pop();selected=null;save();render();toast('ひとつ前の状態に戻しました');},'cancel-swap':()=>{selected=null;renderTeams();},copy:copyTeams,confirm:()=>{if(confirmed())return;confirmAction('この編成でマッチを確定しますか？','実際に使うチームだけを確定してください。次の編成から同じペアの回数に反映します。',()=>{try{mutate(()=>state=C.confirmMatch(state,roster));toast('マッチを確定して履歴に記録しました');}catch(e){message('確定できません',e.message);}},'マッチを確定');},next:generate,'all-present':()=>confirmAction('全員を出席にしますか？','60人すべてを出席に変更します。',()=>mutate(()=>roster.forEach(p=>state.members[p.id].attending=true))),'all-absent':()=>confirmAction('全員を欠席にしますか？','その後、参加する人だけ出席にできます。',()=>mutate(()=>roster.forEach(p=>state.members[p.id].attending=false))),'new-event':()=>confirmAction('当日の履歴をリセットしますか？','履歴と現在のチーム案をリセットします。評価・IGL・関係性・出欠は残ります。必要なら先に設定を書き出してください。元に戻す操作も可能です。',()=>mutate(()=>{state.history=[];state.draft=null;selected=null;}),'履歴をリセット')};
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
    if(el.dataset.rating)mutate(()=>state.members[el.dataset.rating].rating=el.value===''?null:Number(el.value));
    if(el.dataset.igl)mutate(()=>state.members[el.dataset.igl].igl=el.value);
    if(el.dataset.setting)mutate(()=>state.settings[el.dataset.setting]=el.checked);
    if(el.id==='team-filter'){filterTeam=el.value;view==='members'?renderMemberRows():renderRelationRows();}
    if(el.id==='attendance-filter'){filterAttendance=el.value;view==='members'?renderMemberRows():renderRelationRows();}
    if(el.dataset.friend){el.checked?friendDraft.add(el.dataset.friend):friendDraft.delete(el.dataset.friend);$('#friend-count').textContent=friendDraft.size+'人を指定';}
  });
  document.addEventListener('input',event=>{if(event.target.id==='member-search'){search=event.target.value;view==='members'?renderMemberRows():renderRelationRows();}if(event.target.id==='friend-search')renderFriendList();});
  $('#add-affiliation').onclick=()=>{roster.filter(p=>p.id!==editing&&p.team===byId[editing].team).forEach(p=>friendDraft.add(p.id));renderFriendList();};
  $('#editor-form').onsubmit=event=>{event.preventDefault();const social=$('#edit-social').value;if(social==='required'&&!friendDraft.size){toast('知り合いが必要な場合は、相手を1人以上選んでください');return;}mutate(()=>{Object.assign(state.members[editing],{rating:$('#edit-rating').value===''?null:Number($('#edit-rating').value),igl:$('#edit-igl').value,social,friends:[...friendDraft],note:$('#edit-note').value});});$('#editor').close();toast('メンバーの設定を保存しました');};
  $('#export').onclick=exportState;$('#import').onclick=()=>$('#import-file').click();
  $('#import-file').onchange=async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    if(file.size>8*1024*1024){message('読み込めません','設定ファイルは8MB以内にしてください。');return;}
    try{const next=C.validateState(JSON.parse(await file.text()),roster);confirmAction('設定ファイルを読み込みますか？','現在の評価・関係性・出欠・チーム案・履歴を、ファイルの内容に置き換えます。現在の内容は書き出して残せます。読み込み後は「元に戻す」でも戻れます。',()=>{checkpoint();state=next;restoreError='';selected=null;save();render();toast('設定ファイルを読み込みました');},'読み込む');}catch(e){message('設定ファイルを読み込めません',e.message);}
  };
  $('#confirm-cancel').onclick=()=>$('#confirm-dialog').close();
  $('#help-open').onclick=()=>message('使い方・設定の受け渡し','1. メンバー管理で出席者と戦力点・IGLを設定します。\n2. 関係性の設定で、必要な人に知り合いを指定します。\n3. 自動編成し、必要なら2人を選んで交換します。\n4. 実際に使う編成を確定してから、次のマッチを作ります。\n\n設定はこのブラウザに保存されます。自動同期はしません。「設定を書き出す」でJSONファイルを渡し、相手が「読み込む」を使うと引き継げます。\n同時に別々に編集した内容の自動結合はありません。\n\nこのパスワードは簡易ロックです。サイトの内容を暗号化したり、閲覧者を厳密に限定するものではありません。');
  $('#lock').onclick=()=>{try{sessionStorage.removeItem(GATE_KEY);}catch(e){}$('#app').hidden=true;$('#gate').hidden=false;$('#password').value='';$('#password').focus();};
  $('#help-top').onclick=$('#help-open').onclick;$('#lock-top').onclick=$('#lock').onclick;
  $('#show-password').onclick=()=>{const el=$('#password');el.type=el.type==='password'?'text':'password';$('#show-password').textContent=el.type==='password'?'表示':'隠す';};
  $('#login-form').onsubmit=async event=>{event.preventDefault();try{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode($('#password').value)),hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==PASSWORD_HASH){$('#login-error').textContent='パスワードが違います。';return;}try{sessionStorage.setItem(GATE_KEY,PASSWORD_HASH);}catch(e){}unlock();}catch(e){$('#login-error').textContent='HTTPSの公開URLまたはローカルプレビューから開いてください。';}};
  function unlock(){$('#gate').hidden=true;$('#app').hidden=false;$('#password').value='';$('#login-error').textContent='';render();}
  window.addEventListener('storage',event=>{if(event.key===KEY&&event.newValue)toast('別タブで設定が更新されました。必要な設定を書き出してから再読み込みしてください。');});
  try{if(sessionStorage.getItem(GATE_KEY)===PASSWORD_HASH)unlock();}catch(e){}
})();

