/* 비령 v0.5 — 서버 저장형 지신성 / 낮새들의 터 / 밤쥐들의 터 */
(() => {
  const $ = sel => document.querySelector(sel);
  const dialog = $('#communityDialog');
  const profileDialog = $('#communityProfileDialog');
  const content = $('#communityContent');
  const account = $('#communityAccount');
  const feedback = $('#communityFeedback');
  const headings = { social:'지신성', memos:'낮새들의 터', dm:'밤쥐들의 터' };
  const explanations = { social:'山의 소식을 별처럼 나누는 타임라인입니다. 이름을 눌러 그 사람이 남긴 글을 모아볼 수 있습니다.', memos:'낮새들이 모이는 공개 메모 게시판입니다. 이야기 아래에 댓글과 대댓글을 남겨 주세요.', dm:'밤의 밀담은 대화 당사자와 홈페이지 총괄 운영자만 열람할 수 있습니다. 종단 간 암호화 대화는 아닙니다.' };
  const errorText = { database_not_configured:'비령 전용 데이터베이스가 연결되지 않았습니다. Render의 DATABASE_URL을 설정하면 가입·게시글·대화가 활성화됩니다.',login_required:'로그인이 필요합니다.',invalid_username:'계정 ID는 영문 소문자·숫자·밑줄 3~24자로 입력해 주세요.',invalid_password:'비밀번호는 8~128자로 입력해 주세요.',invalid_display_name:'표시 이름은 1~40자로 입력해 주세요.',invalid_credentials:'아이디 또는 비밀번호가 올바르지 않습니다.',username_taken:'이미 사용 중인 계정 ID입니다.',invalid_profile:'프로필 입력값을 확인해 주세요.',invalid_post:'글은 1~500자로 작성해 주세요.',invalid_memo:'제목 또는 메모 글자 수를 확인해 주세요.',invalid_comment:'댓글은 1~1,200자로 작성해 주세요.',invalid_dm:'대화는 1~2,000자로 작성해 주세요.',too_many_requests:'요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.',bad_origin:'보안 정책에 의해 차단되었습니다.',user_not_found:'해당 사용자를 찾을 수 없습니다.',not_found:'대상을 찾을 수 없거나 접근 권한이 없습니다.',internal_error:'일시적인 서버 오류가 발생했습니다.' };
  let tab='social', me=null, authMode='login', loadedMe=false, socialRows=[], memoRows=[], activeMemo=null, activeThread=null, activeOther='', adminView=false, threads=[], dmTimer=null, initialDM=true;
  let busy=false, dmLastId=null, dmOldestId=null;
  function h(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;}
  function button(label,cls,handler){const e=h('button',cls,label);e.type='button';if(handler)e.addEventListener('click',handler);return e;}
  function avatar(user) {const el=h('span','community-avatar',user.avatar_symbol||user.other_avatar_symbol||'✦');el.style.setProperty('--avatar-accent',user.accent||user.other_accent||'#d4b078');el.setAttribute('aria-hidden','true');return el;}
  function formatDate(value){try{return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}catch{return '';}}
  function setFeedback(message){feedback.hidden=!message;feedback.textContent=message||'';}
  async function api(path,options={}){
    let response;
    try {response=await fetch(`api/community/${path}`,{credentials:'same-origin',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});} catch {throw new Error('비령 커뮤니티 서버에 연결할 수 없습니다.');}
    let data;try{data=await response.json();}catch{throw new Error(response.status===404||response.status===405?'이 주소에는 비령 커뮤니티 서버가 연결되어 있지 않습니다. (GitHub Pages 같은 정적 페이지에서는 지도와 화면만 볼 수 있습니다)':'서버에서 잘못된 응답이 왔습니다.');}
    if(!response.ok)throw new Error(errorText[data.error]||data.error||`서버 오류 (${response.status})`);
    return data;
  }
  const post = (path,body,method='POST')=>api(path,{method,body:JSON.stringify(body)});
  async function attempt(task){if(busy)return;busy=true;try{setFeedback('');await task();}catch(err){setFeedback(err.message);}finally{busy=false;}}
  function addIntro(text){content.append(h('p','community-intro',text));}
  function empty(text){return h('div','community-empty',text);}
  function authorHeader(item){
    const row=h('div','community-card-head');row.append(avatar(item));
    const name=button(item.display_name||item.username,'community-author',()=>openProfile(item.username));
    name.append(h('small','',`@${item.username}`)); row.append(name,h('time','community-time',formatDate(item.created_at)));
    return row;
  }
  function profileSummary(profile){
    const wrap=h('div');const banner=h('div','community-profile-banner');banner.style.setProperty('--profile-accent',profile.accent||'#d4b078');wrap.append(banner);
    const title=h('div','community-profile-title');title.append(avatar(profile));
    const texts=h('div');texts.append(h('h3','',profile.display_name),h('p','',`@${profile.username}${profile.role==='admin'?' · 운영자':''}`));title.append(texts);wrap.append(title);
    if(profile.bio)wrap.append(h('p','community-profile-bio',profile.bio));return wrap;
  }
  async function openProfile(username){
    const host=$('#profileContent');host.replaceChildren(empty('프로필을 불러오는 중입니다.'));
    $('#profileTitle').textContent='인물 기록';if(!profileDialog.open)profileDialog.showModal();
    try{const data=await api(`users/${encodeURIComponent(username)}/posts`);host.replaceChildren(profileSummary(data.profile),h('h3','community-stack-title','이 사람이 남긴 지신성 글'));
      if(!data.posts.length)host.append(empty('아직 지신성에 남긴 글이 없습니다.'));
      else data.posts.forEach(item=>host.append(postCard(item)));
      if(data.posts.length===25)host.append(button('이전 글 더 보기','community-load-more',async()=>{
        const last=data.posts[data.posts.length-1].id;
        try{const extra=await api(`users/${encodeURIComponent(username)}/posts?before=${last}`);
          const prior=host.querySelector('.community-load-more');prior?.remove();extra.posts.forEach(p=>host.append(postCard(p)));
        }catch(err){setFeedback(err.message);}
      }));
    }catch(err){host.replaceChildren(empty(err.message));}
  }
  function postCard(item){const card=h('article','community-card');card.append(authorHeader(item),h('p','community-card-body',item.body));
    const meta=h('div','community-card-meta');meta.append(h('span','',`답글 ${item.reply_count||0}개`),button('대화 보기 · 답글','community-mini-btn',()=>openPost(item.id)));card.append(meta);return card;}
  async function openCommunity(nextTab){
    tab=nextTab;dialog.showModal();loadedMe=false;stopDmTimer();content.replaceChildren(empty('비령의 기록을 여는 중입니다.'));
    setFeedback('');await render();
  }
  function stopDmTimer(){if(dmTimer){clearInterval(dmTimer);dmTimer=null;}}
  async function render(){
    stopDmTimer();$('#communityTitle').textContent=headings[tab];
    document.querySelectorAll('[data-community-tab]').forEach(el=>el.setAttribute('aria-selected',String(el.dataset.communityTab===tab)));
    if(!loadedMe){try{const data=await api('me');me=data.user;loadedMe=true;}catch(err){account.replaceChildren();content.replaceChildren(empty(err.message));return;}}
    renderAccount();content.replaceChildren();
    if(!me){renderAuth();return;}
    if(tab==='social')await renderSocial();else if(tab==='memos')await renderMemos();else await renderDm();
  }
  function renderAccount(){account.replaceChildren();
    if(!me){account.append(h('span','','✦ 비령의 공동체에 참여하려면 계정을 생성하거나 로그인해 주세요.'));return;}
    const left=h('div','account-left');left.append(avatar(me));
    const identity=h('div','account-identity');identity.append(h('strong','',me.display_name),h('small','',`@${me.username}${me.role==='admin'?' · 관리자':''}`));left.append(identity);
    const actions=h('div');actions.append(button('프로필 꾸미기','',()=>renderEditProfile()),' ',button('로그아웃','',()=>attempt(async()=>{await post('logout',{});me=null;activeThread=null;adminView=false;await render();})));
    account.append(left,actions);
  }
  function renderAuth(){
    addIntro('지신성 · 낮새들의 터 · 밤쥐들의 터는 비령 자체 계정으로 이용합니다. 초록동색 계정과는 연결되지 않습니다.');
    const outer=h('div','community-auth-layout');const nav=h('div','community-auth-toggle');
    for(const mode of ['login','register']){const b=button(mode==='login'?'입산자 로그인':'새 계정 만들기',authMode===mode?'active':'',()=>{authMode=mode;renderAuthReset();});nav.append(b);}outer.append(nav);
    const form=h('form','community-auth-form');
    function field(text,type,name,max){const label=h('label','',text),input=h('input');input.name=name;input.type=type;input.autocomplete=name==='password'?(authMode==='login'?'current-password':'new-password'):'username';input.required=true;input.maxLength=max;label.append(input);form.append(label);return input;}
    const username=field('계정 ID (영문·숫자·밑줄, 3~24자)','text','username',24);
    let displayName;if(authMode==='register')displayName=field('표시 이름 (캐릭터 이름 가능)','text','display',40);
    const password=field('비밀번호 (8자 이상)','password','password',128);password.minLength=8;
    const submit=h('button','community-primary',authMode==='login'?'입산하기':'가입하고 입산하기');submit.type='submit';form.append(submit);
    form.addEventListener('submit',event=>{event.preventDefault();attempt(async()=>{
      const payload={username:username.value.trim().toLowerCase(),password:password.value};if(authMode==='register')payload.displayName=displayName.value.trim();
      const data=await post(authMode==='register'?'register':'login',payload);me=data.user;loadedMe=true;await render();
    });});outer.append(form);
    outer.append(h('p','community-warning','계정과 게시글 및 쪽지는 비령 전용 서버에 보관됩니다. 비밀번호는 암호화된 해시로 저장합니다. 밤쥐들의 터는 운영자 열람이 가능한 비공개 대화입니다.'));
    content.append(outer);
  }
  function renderAuthReset(){content.replaceChildren();renderAuth();}
  function renderEditProfile(){content.replaceChildren();addIntro('비령에서 사용할 이름, 자기소개, 상징과 인장을 꾸밀 수 있습니다.');
    const wrap=h('div','community-editor');wrap.append(profileSummary(me));
    const form=h('form','community-form');
    function makeField(label,value,max,textarea=false){const l=h('label','',label);const e=h(textarea?'textarea':'input');e.value=value;e.maxLength=max;e.required=!textarea;l.append(e);form.append(l);return e;}
    const displayName=makeField('표시 이름',me.display_name,40);const bio=makeField('프로필 한마디 · 300자',me.bio||'',300,true);const symbol=makeField('프로필 상징 (1~2글자 또는 이모지)',me.avatar_symbol||'✦',8);
    const colorLabel=h('label','','인장 색상');const select=h('select');
    for(const [value,name] of [['#d4b078','황금'],['#68a9b9','청옥'],['#d56b69','적색'],['#8fa997','연녹'],['#b1a1cc','연자'],['#d7b389','황토']]){const option=h('option','',name);option.value=value;option.selected=value===me.accent;select.append(option);}colorLabel.append(select);form.append(colorLabel);
    const row=h('div','compose-actions');row.append(button('돌아가기','community-secondary',()=>render()),h('button','community-primary','저장하기'));row.lastChild.type='submit';form.append(row);
    form.addEventListener('submit',e=>{e.preventDefault();attempt(async()=>{const result=await post('profile',{displayName:displayName.value,bio:bio.value,avatarSymbol:symbol.value,accent:select.value},'PATCH');me=result.user;await render();});});wrap.append(form);content.append(wrap);
  }
  function composer(placeholder,max,submitLabel,onSubmit){const form=h('form','community-form');const input=h('textarea');input.maxLength=max;input.placeholder=placeholder;input.required=true;input.rows=3;form.append(input);
    const actions=h('div','compose-actions'),count=h('span','community-counter',`0 / ${max}`);input.addEventListener('input',()=>count.textContent=`${input.value.length} / ${max}`);
    const submit=h('button','community-primary',submitLabel);submit.type='submit';actions.append(count,submit);form.append(actions);
    form.addEventListener('submit',e=>{e.preventDefault();attempt(async()=>{await onSubmit(input.value);input.value='';count.textContent=`0 / ${max}`;});});return form;
  }
  async function openPost(id){
    content.replaceChildren(empty('지신성의 대화를 여는 중입니다.'));
    try{
      const data=await api(`posts/${id}/replies`);content.replaceChildren();
      content.append(button('← 지신성 타임라인으로','community-back',()=>renderSocialReset()),h('h3','community-stack-title','지신성 · 한 별의 대화'),postCard(data.post));
      content.append(h('h3','community-stack-title',`이어진 이야기 · ${data.replies.length}개`));
      const replies=h('div');
      if(!data.replies.length)replies.append(empty('아직 이어진 답글이 없습니다.'));
      for(const reply of data.replies){const card=h('article','community-comment');card.append(authorHeader(reply),h('p','community-card-body',reply.body));replies.append(card);}
      content.append(replies,h('h3','community-stack-title','이야기에 답하기'),composer('이 글에 이어 이야기를 남겨 주세요…',500,'답글 남기기',async text=>{await post(`posts/${id}/replies`,{body:text});await openPost(id);}));
    }catch(err){content.replaceChildren(empty(err.message),button('← 돌아가기','community-back',()=>renderSocialReset()));}
  }
  async function renderSocial(){socialRows=[];addIntro(explanations.social);
    content.append(composer('비령산의 오늘을 한 줄로 전해 주세요…',500,'지신성에 글 남기기',async text=>{await post('posts',{body:text});await renderSocialReset();}));
    content.append(h('h3','community-stack-title','지신성 · 최근의 소식'));
    await loadSocial(true);
  }
  async function renderSocialReset(){content.replaceChildren();await renderSocial();}
  async function loadSocial(reset){try{
    const old=content.querySelector('#socialFeed');if(old)old.remove();
    if(reset)socialRows=[];
    const before=socialRows.length?`?before=${socialRows[socialRows.length-1].id}`:'';
    const data=await api(`posts${before}`);socialRows.push(...data.posts);
    const list=h('div');list.id='socialFeed';if(!socialRows.length)list.append(empty('아직 별에 남겨진 말이 없습니다. 첫 글을 남겨 보세요.'));
    socialRows.forEach(item=>list.append(postCard(item)));
    if(data.posts.length===25)list.append(button('오래된 글 더 보기','community-load-more',()=>loadSocial(false).catch(e=>setFeedback(e.message))));
    content.append(list);
  }catch(err){setFeedback(err.message);}}
  function memoCard(item){const card=h('article','community-card');card.append(authorHeader(item),h('h3','community-card-title',item.title),h('p','community-card-body',item.body));
    const meta=h('div','community-card-meta');meta.append(h('span','',`댓글 ${item.comment_count||0}개`),button('메모 읽기 · 댓글','community-mini-btn',()=>openMemo(item.id)));card.append(meta);return card;
  }
  async function renderMemos(){activeMemo=null;memoRows=[];addIntro(explanations.memos);
    const form=h('form','community-form'),title=h('input');title.placeholder='메모 제목';title.required=true;title.maxLength=100;
    const body=h('textarea');body.placeholder='한줄역극과 메모를 남겨 보세요…';body.maxLength=3000;body.required=true;body.rows=3;
    const send=h('button','community-primary','메모 게시하기');send.type='submit';form.append(title,body,send);
    form.addEventListener('submit',event=>{event.preventDefault();attempt(async()=>{await post('memos',{title:title.value,body:body.value});await renderMemosReset();});});
    content.append(form,h('h3','community-stack-title','낮의 게시판'));await loadMemos(true);
  }
  async function renderMemosReset(){content.replaceChildren();await renderMemos();}
  async function loadMemos(reset){try{if(reset)memoRows=[];
    const before=memoRows.length?`?before=${memoRows[memoRows.length-1].id}`:'';
    const data=await api(`memos${before}`);memoRows.push(...data.memos);
    content.querySelector('#memoFeed')?.remove();const list=h('div');list.id='memoFeed';
    if(!memoRows.length)list.append(empty('아직 게시된 메모가 없습니다.'));
    memoRows.forEach(item=>list.append(memoCard(item)));
    if(data.memos.length===20)list.append(button('이전 메모 더 보기','community-load-more',()=>loadMemos(false)));
    content.append(list);
  }catch(err){setFeedback(err.message);}}
  async function openMemo(id){activeMemo=id;content.replaceChildren(empty('메모를 불러오는 중입니다.'));
    try{const data=await api(`memos/${id}/comments`);content.replaceChildren();
      content.append(button('← 낮새들의 터로','community-back',()=>renderMemosReset()),h('h3','community-stack-title','메모 · 한줄역극'));
      content.append(memoCardDetail(data.memo),h('h3','community-stack-title',`댓글과 대댓글 · ${data.comments.length}개`));
      const tree=h('div');const map=new Map(data.comments.map(c=>[String(c.id),c]));
      function depth(comment){let n=0,seen=new Set([String(comment.id)]),current=comment;while(current.parent_id && n<3){if(seen.has(String(current.parent_id)))break;seen.add(String(current.parent_id));n++;current=map.get(String(current.parent_id));if(!current)break;}return n;}
      data.comments.forEach(comment=>{const node=h('article','community-comment');node.style.setProperty('--indent',depth(comment));node.append(authorHeader(comment),h('p','community-card-body',comment.body));
        if(comment.parent_id){const parent=map.get(String(comment.parent_id));if(parent)node.append(h('small','community-counter',`↳ @${parent.username}에게 답글`));}
        const toolbar=h('div','community-comments-toolbar');toolbar.append(button('↳ 답글','community-mini-btn',()=>{node.querySelector('form')?.remove();node.append(composer('대댓글을 입력하세요…',1200,'대댓글 남기기',async text=>{await post(`memos/${id}/comments`,{body:text,parentId:comment.id});await openMemo(id);}));}));node.append(toolbar);tree.append(node);
      });if(!data.comments.length)tree.append(empty('아직 댓글이 없습니다.'));
      content.append(tree,h('h3','community-stack-title','댓글 남기기'),composer('메모에 이어 이야기를 남겨 주세요…',1200,'댓글 게시',async text=>{await post(`memos/${id}/comments`,{body:text});await openMemo(id);}));
    }catch(err){content.replaceChildren(empty(err.message),button('← 돌아가기','community-back',()=>renderMemosReset()));}
  }
  function memoCardDetail(memo){const card=h('article','community-card');card.append(authorHeader(memo),h('h3','community-card-title',memo.title),h('p','community-card-body',memo.body));return card;}
  async function renderDm(){stopDmTimer();content.replaceChildren();addIntro(explanations.dm);
    if(me.role==='admin')content.append(button(adminView?'← 내 비밀 대화로':'운영자 · 전체 대화 열람','community-secondary',()=>{adminView=!adminView;activeThread=null;renderDm();}));
    const layout=h('div','community-dm-layout'),sidebar=h('div','community-dm-sidebar'),chat=h('div','community-dm-chat');sidebar.append(h('h3','',adminView?'관리자 열람 목록':'나의 1:1 대화 목록'));
    if(!adminView){const search=h('div','community-dm-search'),input=h('input');input.placeholder='대화 상대 ID 검색';input.maxLength=24;input.setAttribute('aria-label','대화 상대 ID 검색');
      const find=button('검색','',()=>searchUsers(input.value,sidebar));search.append(input,find);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchUsers(input.value,sidebar);}});sidebar.append(search);
      const results=h('div','community-dm-search-results');results.id='communityUserResults';sidebar.append(results);
    }
    const list=h('div','community-dm-list');list.id='dmThreadList';sidebar.append(list);layout.append(sidebar,chat);content.append(layout);
    try{threads=(await api(adminView?'admin/dm/threads':'dm/threads')).threads;list.replaceChildren();
      if(!threads.length)list.append(empty(adminView?'조회 가능한 대화가 없습니다.':'대화 상대를 검색해 비밀 대화를 시작하세요.'));
      for(const t of threads){const label=adminView?`${t.user_low} ↔ ${t.user_high}`:t.other_display_name||t.other_username;
        const row=button(label,'community-dm-item',()=>{activeThread=String(t.id);activeOther=label;initialDM=true;dmLastId=null;dmOldestId=null;renderDm();});
        row.setAttribute('aria-current',String(String(t.id)===String(activeThread)));
        row.append(h('small','',adminView?`${t.message_count}개 대화`:t.last_body||`@${t.other_username} · 대화를 시작하세요`));list.append(row);
      }
      const current=threads.find(t=>String(t.id)===String(activeThread));
      if(!current){chat.append(empty('왼쪽에서 대화를 선택해 주세요.'));activeThread=null;return;}
      const title=adminView?`${current.user_low} ↔ ${current.user_high}`:current.other_display_name||current.other_username;
      chat.append(h('div','community-dm-chat-head',`${adminView?'운영자 열람 · ':''}${title}`));const messages=h('div','community-dm-messages');messages.id='communityDmMessages';chat.append(messages);
      if(!adminView){const form=h('form','community-dm-send'),input=h('input');input.placeholder='밀담을 남겨 주세요';input.maxLength=2000;input.required=true;input.setAttribute('aria-label','새 비밀 메시지');
        const send=h('button','','전송');send.type='submit';form.append(input,send);form.addEventListener('submit',e=>{e.preventDefault();attempt(async()=>{await post(`dm/threads/${activeThread}/messages`,{body:input.value});input.value='';await refreshMessages();});});chat.append(form);
      }else chat.append(h('p','community-warning','운영자 감사 열람 · 읽기 전용 · 열람 시각이 서버에 기록됩니다.'));
      await refreshMessages();
      if(!adminView)dmTimer=setInterval(()=>{if(dialog.open && tab==='dm'&&activeThread && !document.hidden)refreshMessages().catch(()=>{});},12000);
    }catch(err){chat.replaceChildren(empty(err.message));}
  }
  async function searchUsers(q,sidebar){const host=sidebar.querySelector('#communityUserResults');if(!host)return;host.replaceChildren();
    if(!q.trim()){host.append(h('p','community-warning','검색할 계정 ID를 입력하세요.'));return;}
    try{const data=await api(`users?q=${encodeURIComponent(q.trim())}`);if(!data.users.length)host.append(h('p','community-warning','검색 결과가 없습니다.'));
      for(const person of data.users){const b=button(`@${person.username} · ${person.display_name}`,'community-dm-item',()=>attempt(async()=>{const result=await post('dm/threads',{username:person.username});activeThread=String(result.threadId);adminView=false;await renderDm();}));host.append(b);}
    }catch(err){setFeedback(err.message);}
  }
  function messageBubble(message){
    const bubble=h('div','community-bubble'+(String(message.sender_id)===String(me.id)?' mine':''));
    bubble.dataset.messageId=String(message.id);
    bubble.append(h('div','',message.body),h('small','',`@${message.sender_username} · ${formatDate(message.created_at)}`));return bubble;
  }
  async function loadOlderMessages(){
    const list=$('#communityDmMessages'),id=activeThread;
    if(!list || !dmOldestId)return;
    try{
      const before=dmOldestId,oldHeight=list.scrollHeight;
      const data=await api(`${adminView?'admin/':''}dm/threads/${id}/messages?before=${before}`);
      if(activeThread!==id || !data.messages.length){list.querySelector('.community-load-more')?.remove();return;}
      dmOldestId=data.messages[0].id;
      const more=list.querySelector('.community-load-more');
      const anchor=more?.nextSibling||list.firstChild;
      for(const message of data.messages)list.insertBefore(messageBubble(message),anchor);
      if(data.messages.length<50)more?.remove();
      list.scrollTop+=list.scrollHeight-oldHeight;
    }catch(err){setFeedback(err.message);}
  }
  async function refreshMessages(){if(!activeThread)return;const id=activeThread;
    const url=`${adminView?'admin/':''}dm/threads/${id}/messages${!initialDM&&dmLastId?`?after=${dmLastId}`:''}`;
    const data=await api(url);
    if(String(activeThread)!==String(id))return;
    const list=$('#communityDmMessages');if(!list)return;
    const wasInitial=initialDM;
    const shouldScroll=wasInitial || list.scrollHeight-list.scrollTop-list.clientHeight<70;
    if(wasInitial){
      list.replaceChildren();dmLastId=null;dmOldestId=null;
      if(!data.messages.length)list.append(empty('아직 남겨진 대화가 없습니다.'));
      else if(data.messages.length===50)list.append(button('오래된 대화 불러오기','community-load-more',loadOlderMessages));
    }else if(data.messages.length){list.querySelector('.community-empty')?.remove();}
    for(const message of data.messages){
      if(!dmOldestId)dmOldestId=message.id;
      if(!dmLastId || Number(message.id)>Number(dmLastId))dmLastId=message.id;
      list.append(messageBubble(message));
    }
    if(shouldScroll)list.scrollTop=list.scrollHeight;initialDM=false;
  }
  fetch('health',{cache:'no-store'}).then(r=>r.ok?r.json().catch(()=>null):null).then(info=>{
    const status=$('#communityConnectionStatus');if(status)status.textContent=!info?'학당 통신 · 서버 미연결':info.database==='configured'?'비령 내부 통신 연결':'학당 통신 · 서버 설정 필요';
  }).catch(()=>{const status=$('#communityConnectionStatus');if(status)status.textContent='학당 통신 · 서버 미연결';});
  document.querySelectorAll('[data-community]').forEach(btn=>btn.addEventListener('click',()=>openCommunity(btn.dataset.community)));
  document.querySelectorAll('[data-community-tab]').forEach(btn=>btn.addEventListener('click',()=>{tab=btn.dataset.communityTab;activeMemo=null;activeThread=null;adminView=false;setFeedback('');render().catch(e=>setFeedback(e.message));}));
  $('#communityClose').addEventListener('click',()=>dialog.close());
  $('#profileClose').addEventListener('click',()=>profileDialog.close());
  dialog.addEventListener('close',stopDmTimer);
  for(const modal of [dialog,profileDialog])modal.addEventListener('click',event=>{if(event.target===modal)modal.close();});
})();
