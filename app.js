import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.JUMP_METRICS_CONFIG || {};
const configured = /^https:\/\/.+\.supabase\.co$/.test(cfg.SUPABASE_URL || '') && !!cfg.SUPABASE_PUBLISHABLE_KEY;
const supabase = configured ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY) : null;
const PROFESSIONAL_EMAIL = 'studiojumpmetrics@gmail.com';
const $app = document.querySelector('#app');

const state = {
  session: null,
  user: null,
  isProfessional: false,
  organizationId: null,
  assessees: [],
  wizard: null,
  busy: false,
};

const protocols = [
  'BodyMetrix — Jackson & Pollock 3 dobras',
  'BodyMetrix — Jackson & Pollock 7 dobras',
  'Jackson & Pollock 3 dobras',
  'Jackson & Pollock 7 dobras',
  'Petroski 4 dobras',
  'Faulkner 4 dobras',
  'Guedes 3 dobras',
  'Durnin & Womersley',
  'Yuhasz',
  'Slaughter — crianças e adolescentes',
  'Siri',
  'Brozek',
  'Outro protocolo'
];

const circFields = [
  ['neck_cm','Pescoço'],['shoulder_cm','Ombro'],['chest_cm','Peito'],['biceps_cm','Bíceps'],
  ['waist_cm','Cintura'],['hip_cm','Quadril'],['thigh_cm','Coxa'],['calf_cm','Panturrilha']
];

const route = () => (location.hash.replace(/^#/, '') || '/').split('?')[0];
const go = path => { location.hash = path; };
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const num = v => v === '' || v == null ? null : Number(String(v).replace(',','.'));
const fmt = (v,s='') => v == null || v === '' ? '—' : `${Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2})}${s}`;
const dateBR = d => d ? new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR') : '—';
const today = () => new Date().toISOString().slice(0,10);
const uid = () => globalThis.crypto?.randomUUID?.() || `jm-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const sleep = ms => new Promise(r=>setTimeout(r,ms));

function toast(message, type='ok') {
  const el=document.createElement('div');
  el.className=`alert alert-${type==='error'?'error':'ok'}`;
  el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:9999;max-width:420px;box-shadow:0 16px 40px #0003';
  el.textContent=message; document.body.appendChild(el); setTimeout(()=>el.remove(),4200);
}

function configAlert(){return configured?'':`<div class="alert alert-error">A conexão com o Supabase ainda não foi configurada. Confira o arquivo <b>config.js</b>.</div>`}
function logo(){return `<div class="brand"><img src="./jump-metrics-logo.png" alt="Jump Metrics"></div>`}
function loading(text='Carregando...'){return `<div class="empty"><div style="font-size:34px">⌛</div><p>${esc(text)}</p></div>`}
function empty(text){return `<div class="empty">${esc(text)}</div>`}

async function initialize(){
  if(configured){
    const {data}=await supabase.auth.getSession();
    await setSession(data.session);
    supabase.auth.onAuthStateChange(async(_event,session)=>{await setSession(session); render();});
  }
  window.addEventListener('hashchange',render);
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  render();
}

async function setSession(session){
  state.session=session; state.user=session?.user||null; state.isProfessional=false; state.organizationId=null;
  if(!state.user) return;
  const email=(state.user.email||'').toLowerCase();
  if(email===PROFESSIONAL_EMAIL){
    try{
      const {data,error}=await supabase.rpc('bootstrap_professional_access');
      if(error) throw error;
      state.organizationId=data;
      state.isProfessional=!!data;
    }catch(e){console.error(e);}
  }else{
    try{await supabase.rpc('claim_assessee_by_email');}catch(e){console.warn(e);}
  }
}

function publicHome(){
  return `<div>
    <header class="container public-header">${logo()}<nav class="public-nav"><button class="btn btn-secondary" data-go="/login">Acessar resultados</button><button class="btn btn-primary" data-go="/login">Entrar</button></nav></header>
    <main class="container">
      <section class="hero">
        <div><p class="eyebrow">Uma plataforma Studio Jump</p><h1>Avaliar melhor.<br><span>Evoluir com dados.</span></h1><p>Cadastro, sinais vitais, circunferências, composição corporal, fotos e laudos BodyMetrix em um fluxo profissional pensado para o atendimento no iPad.</p><div class="top-actions" style="margin-top:26px"><button class="btn btn-primary" data-go="/login">Acessar a plataforma</button><button class="btn btn-secondary" data-go="/login?tab=signup">Sou aluno ou avaliado</button></div></div>
        <div class="hero-art"><div class="hero-badge hero-promo"><span>AVALIAÇÃO FÍSICA POR ULTRASSOM</span><b>Conheça seu corpo. Acompanhe sua evolução.</b><span>Composição corporal, fotos comparativas e laudos BodyMetrix em um acompanhamento profissional.</span><div class="promo-tags"><i>Precisão</i><i>Evolução</i><i>Performance</i></div></div></div>
      </section>
      <section class="feature-strip"><div class="feature"><b>👤 Cadastro organizado</b><span class="muted small">ID automático e histórico individual.</span></div><div class="feature"><b>❤️ Saúde e medidas</b><span class="muted small">PA, FC, SpO₂ e circunferências.</span></div><div class="feature"><b>📡 BodyMetrix</b><span class="muted small">Composição, protocolos e laudos.</span></div><div class="feature"><b>🔐 Portal privado</b><span class="muted small">O aluno consulta resultados e arquivos.</span></div></section>
    </main><footer class="footer">Jump Metrics • Avaliação & Performance • Studio Jump Alta Performance</footer>
  </div>`;
}

function authPage(){
  const signup=new URLSearchParams(location.hash.split('?')[1]||'').get('tab')==='signup';
  return `<div class="auth-page"><section class="auth-card"><div class="auth-logo"><img src="./jump-metrics-logo.png" alt="Jump Metrics"></div><h1>${signup?'Criar acesso de aluno':'Acessar Jump Metrics'}</h1><p class="muted">${signup?'Use o mesmo e-mail informado no seu cadastro para acessar avaliações, fotos e laudos.':'Entre com seu e-mail e senha. O profissional autorizado acessa o painel; alunos acessam seus próprios resultados.'}</p>${configAlert()}
    <div class="tabs"><button class="${signup?'':'active'}" data-auth-tab="login">Entrar</button><button class="${signup?'active':''}" data-auth-tab="signup">Aluno / avaliado</button></div>
    <form id="auth-form" class="form" data-mode="${signup?'signup':'login'}">
      ${signup?'<div class="field"><label>Nome completo</label><input class="input" name="name" required></div>':''}
      <div class="field"><label>E-mail</label><input class="input" name="email" type="email" required autocomplete="email"></div>
      <div class="field"><label>Senha</label><input class="input" name="password" type="password" minlength="6" required autocomplete="${signup?'new-password':'current-password'}"></div>
      <div id="auth-message"></div><button class="btn btn-primary btn-block" ${configured?'':'disabled'}>${signup?'Criar minha conta':'Entrar na plataforma'}</button>
    </form>
    ${signup?'':'<button class="btn btn-ghost btn-block" id="forgot-password" style="margin-top:10px">Esqueci minha senha</button>'}
    <button class="btn btn-secondary btn-block" data-go="/" style="margin-top:10px">Voltar ao início</button>
  </section></div>`;
}

async function authSubmit(form){
  const fd=new FormData(form), mode=form.dataset.mode, email=fd.get('email').trim(), password=fd.get('password'), msg=document.querySelector('#auth-message');
  msg.innerHTML=loading('Aguarde...');
  try{
    if(mode==='signup'){
      if(email.toLowerCase()===PROFESSIONAL_EMAIL) throw new Error('Este e-mail é reservado ao acesso profissional.');
      const {error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:`${location.origin}${location.pathname}#/redirect`,data:{full_name:fd.get('name')}}});
      if(error) throw error;
      msg.innerHTML='<div class="alert alert-ok">Conta criada. Confirme o e-mail recebido e depois entre normalmente.</div>';
    }else{
      const {error}=await supabase.auth.signInWithPassword({email,password}); if(error) throw error;
      await sleep(300); go('/redirect');
    }
  }catch(e){msg.innerHTML=`<div class="alert alert-error">${esc(e.message)}</div>`;}
}

async function forgotPassword(){
  const email=prompt('Digite seu e-mail para receber a recuperação de senha:'); if(!email)return;
  const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}${location.pathname}#/nova-senha`});
  if(error) toast(error.message,'error'); else toast('Enviamos o link de recuperação para seu e-mail.');
}

function resetPasswordPage(){return `<div class="auth-page"><section class="auth-card"><div class="auth-logo"><img src="./jump-metrics-logo.png"></div><h1>Definir nova senha</h1><p class="muted">Crie uma nova senha com pelo menos seis caracteres.</p><form id="reset-form" class="form"><div class="field"><label>Nova senha</label><input class="input" type="password" name="password" minlength="6" required></div><div id="reset-message"></div><button class="btn btn-primary btn-block">Salvar nova senha</button></form></section></div>`}

async function redirectPage(){
  if(!state.user) return authPage();
  if(state.isProfessional){go('/admin');return loading('Abrindo painel profissional...');}
  go('/meus-resultados');return loading('Abrindo seus resultados...');
}

function sidebar(active='dashboard'){
  return `<aside class="sidebar">${logo()}<div class="side-label">Painel profissional</div><nav class="side-nav">
    <button class="${active==='dashboard'?'active':''}" data-go="/admin">▦ Visão geral</button>
    <button class="${active==='assessees'?'active':''}" data-go="/admin/avaliados">👥 Avaliados</button>
    <button data-go="/admin/avaliado/novo">＋ Novo avaliado</button>
    <button data-go="/admin/avaliacao/nova">▶ Modo avaliação</button>
  </nav><div class="side-footer">PROF. ANDRÉ DE SÁ<br>STUDIO JUMP ALTA PERFORMANCE</div><button class="btn btn-secondary btn-sm" id="logout">Sair</button></aside>`;
}
function appShell(content,active){return `<div class="app-shell">${sidebar(active)}<main class="main">${content}</main></div>`}
function guardProfessional(){if(!state.user){go('/login');return false}if(!state.isProfessional){go('/meus-resultados');return false}return true}

async function loadAssessees(force=false){
  if(state.assessees.length&&!force)return state.assessees;
  const {data,error}=await supabase.from('assessees').select('*').order('full_name'); if(error) throw error; state.assessees=data||[]; return state.assessees;
}
async function loadDashboard(){
  await loadAssessees(true);
  const ids=state.assessees.map(a=>a.id); let evals=[];
  if(ids.length){const {data}=await supabase.from('evaluations').select('id,assessee_id,assessed_at').in('assessee_id',ids).order('assessed_at',{ascending:false});evals=data||[]}
  const latest=evals.slice(0,6);
  const rows=latest.map(e=>{const a=state.assessees.find(x=>x.id===e.assessee_id);return `<tr><td>${dateBR(e.assessed_at)}</td><td>${esc(a?.full_name||'—')}</td><td><span class="code">${esc(a?.public_id||'—')}</span></td><td><button class="btn btn-secondary btn-sm" data-go="/admin/avaliado/${e.assessee_id}">Abrir</button></td></tr>`}).join('');
  return appShell(`<div class="topbar"><div><p class="eyebrow">Jump Metrics</p><h1>Visão geral</h1><p class="muted">Seu centro de avaliações e acompanhamento.</p></div><div class="top-actions"><button class="btn btn-secondary" data-go="/admin/avaliado/novo">Novo avaliado</button><button class="btn btn-primary" data-go="/admin/avaliacao/nova">Iniciar avaliação</button></div></div>
  <section class="stats"><div class="stat"><span>Avaliados cadastrados</span><b>${state.assessees.length}</b></div><div class="stat"><span>Avaliações registradas</span><b>${evals.length}</b></div><div class="stat"><span>Avaliados com acesso</span><b>${state.assessees.filter(a=>a.account_user_id).length}</b></div></section>
  <section class="card"><div class="section-head"><h2>Últimas avaliações</h2><button class="btn btn-secondary btn-sm" data-go="/admin/avaliados">Ver avaliados</button></div>${rows?`<div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Avaliado</th><th>ID</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:empty('Nenhuma avaliação registrada ainda.')}</section>`, 'dashboard');
}

async function assesseesPage(){
  await loadAssessees(true);
  return appShell(`<div class="topbar"><div><p class="eyebrow">Cadastros</p><h1>Avaliados</h1><p class="muted">Pesquise pessoas, abra históricos e inicie avaliações.</p></div><div class="top-actions"><button class="btn btn-primary" data-go="/admin/avaliado/novo">＋ Novo avaliado</button></div></div>
  <section class="card"><div class="toolbar"><input id="assessee-search" class="input search" placeholder="Pesquisar por nome, e-mail, telefone ou ID"><span class="badge" id="result-count">${state.assessees.length} registros</span></div><div id="assessees-table">${assesseesTable(state.assessees)}</div></section>`, 'assessees');
}
function assesseesTable(items){
  if(!items.length)return empty('Nenhum avaliado encontrado.');
  return `<div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>Nome</th><th>Perfil</th><th>E-mail</th><th>Telefone</th><th>Acesso</th><th></th></tr></thead><tbody>${items.map(a=>`<tr><td><span class="code">${esc(a.public_id)}</span></td><td><b>${esc(a.full_name)}</b></td><td><span class="badge ${a.athletic_profile==='Elite'?'badge-elite':a.athletic_profile==='Atlético'?'badge-athlete':''}">${esc(a.athletic_profile)}</span></td><td>${esc(a.email||'—')}</td><td>${esc(a.phone||'—')}</td><td>${a.account_user_id?'<span class="badge">Ativo</span>':'Pendente'}</td><td><button class="btn btn-secondary btn-sm" data-go="/admin/avaliado/${a.id}">Abrir</button></td></tr>`).join('')}</tbody></table></div>`;
}

function assesseeForm(a={}){
  const editing=!!a.id;
  return appShell(`<div class="topbar"><div><p class="eyebrow">${editing?'Editar cadastro':'Novo cadastro'}</p><h1>${editing?'Dados do avaliado':'Cadastrar avaliado'}</h1><p class="muted">Informações de identificação e acesso individual.</p></div></div>
  <section class="card"><form id="assessee-form" class="form" data-id="${a.id||''}"><div class="grid grid-2">
    <div class="field"><label>Nome completo</label><input class="input" name="full_name" value="${esc(a.full_name||'')}" required></div>
    <div class="field"><label>Data de nascimento</label><input class="input" type="date" name="birth_date" value="${esc(a.birth_date||'')}"></div>
    <div class="field"><label>Sexo</label><select class="select" name="sex"><option value="">Selecione</option><option ${a.sex==='Masculino'?'selected':''}>Masculino</option><option ${a.sex==='Feminino'?'selected':''}>Feminino</option><option ${a.sex==='Outro'?'selected':''}>Outro</option></select></div>
    <div class="field"><label>Tipo atlético</label><select class="select" name="athletic_profile"><option ${a.athletic_profile==='Não atlético'?'selected':''}>Não atlético</option><option ${a.athletic_profile==='Atlético'?'selected':''}>Atlético</option><option ${a.athletic_profile==='Elite'?'selected':''}>Elite</option></select></div>
    <div class="field"><label>E-mail</label><input class="input" type="email" name="email" value="${esc(a.email||'')}"></div>
    <div class="field"><label>Telefone / WhatsApp</label><input class="input" name="phone" value="${esc(a.phone||'')}"></div>
  </div><div class="field"><label>Observação inicial</label><textarea class="textarea" name="notes">${esc(a.notes||'')}</textarea></div>
  <label style="display:flex;gap:9px;align-items:flex-start"><input type="checkbox" name="consent_data" ${a.consent_data?'checked':''}><span class="small">Autorização para tratamento dos dados da avaliação.</span></label>
  <label style="display:flex;gap:9px;align-items:flex-start"><input type="checkbox" name="consent_images" ${a.consent_images?'checked':''}><span class="small">Autorização para armazenar fotos de acompanhamento.</span></label>
  <div id="form-message"></div><div class="top-actions"><button type="button" class="btn btn-secondary" data-go="${editing?`/admin/avaliado/${a.id}`:'/admin/avaliados'}">Cancelar</button><button class="btn btn-primary">${editing?'Salvar alterações':'Cadastrar e iniciar avaliação'}</button></div></form></section>`, 'assessees');
}

async function saveAssessee(form){
  const fd=new FormData(form), id=form.dataset.id;
  const payload={full_name:fd.get('full_name').trim(),birth_date:fd.get('birth_date')||null,sex:fd.get('sex')||null,athletic_profile:fd.get('athletic_profile'),email:fd.get('email')?.trim()||null,phone:fd.get('phone')?.trim()||null,notes:fd.get('notes')?.trim()||null,consent_data:fd.get('consent_data')==='on',consent_images:fd.get('consent_images')==='on',consent_at:new Date().toISOString()};
  let result;
  if(id) result=await supabase.from('assessees').update(payload).eq('id',id).select().single();
  else result=await supabase.from('assessees').insert({...payload,organization_id:state.organizationId}).select().single();
  if(result.error)throw result.error;
  await loadAssessees(true);
  if(id){toast('Cadastro atualizado.');go(`/admin/avaliado/${id}`)}else{startWizard(result.data);}
}

async function assesseeDetail(id){
  const [{data:a,error},{data:evals},{data:files}]=await Promise.all([
    supabase.from('assessees').select('*').eq('id',id).single(),
    supabase.from('evaluations').select('*').eq('assessee_id',id).order('assessed_at',{ascending:false}),
    supabase.from('evaluation_photos').select('*').eq('assessee_id',id).order('created_at',{ascending:false})
  ]); if(error)throw error;
  const latest=evals?.[0];
  const fileCards=await signedFileCards(files||[]);
  const evalRows=(evals||[]).map(e=>`<tr><td>${dateBR(e.assessed_at)}</td><td>${esc(e.assessment_protocol||'—')}</td><td>${fmt(e.weight_kg,' kg')}</td><td>${fmt(e.body_fat_percent,'%')}</td><td><div class="inline-actions"><button class="btn btn-secondary btn-sm" data-go="/admin/avaliado/${id}/avaliacao/${e.id}">Abrir</button><button class="btn btn-danger btn-sm" data-delete-evaluation="${e.id}" data-assessee="${id}">Apagar</button></div></td></tr>`).join('');
  return appShell(`<div class="profile-head"><div><p class="eyebrow">Perfil do avaliado</p><h1 style="margin:5px 0;font-size:38px">${esc(a.full_name)}</h1><div class="profile-meta"><span class="code">${esc(a.public_id)}</span><span class="badge">${esc(a.athletic_profile)}</span><span class="badge">${a.account_user_id?'Acesso ativo':'Acesso ainda não criado'}</span></div></div><div class="top-actions"><button class="btn btn-secondary" data-send-access="${a.id}">Enviar acesso</button><button class="btn btn-secondary" data-go="/admin/avaliado/${a.id}/editar">Editar</button><button class="btn btn-danger" data-delete-assessee="${a.id}">Apagar</button><button class="btn btn-primary" data-start-wizard="${a.id}">Nova avaliação</button></div></div>
  <section class="grid grid-2 section"><div class="card"><div class="section-head"><h2>Dados do avaliado</h2></div><div class="kv"><div><span>E-mail</span><b>${esc(a.email||'—')}</b></div><div><span>Telefone</span><b>${esc(a.phone||'—')}</b></div><div><span>Nascimento</span><b>${dateBR(a.birth_date)}</b></div><div><span>Sexo</span><b>${esc(a.sex||'—')}</b></div></div></div>
  <div class="card"><div class="section-head"><h2>Última avaliação</h2></div>${latest?`<div class="kv"><div><span>Data</span><b>${dateBR(latest.assessed_at)}</b></div><div><span>Peso</span><b>${fmt(latest.weight_kg,' kg')}</b></div><div><span>Gordura</span><b>${fmt(latest.body_fat_percent,'%')}</b></div><div><span>Massa magra</span><b>${fmt(latest.lean_mass_kg,' kg')}</b></div><div><span>Pressão</span><b>${fmt(latest.systolic_bp_mmhg)}/${fmt(latest.diastolic_bp_mmhg)}</b></div><div><span>SpO₂</span><b>${fmt(latest.blood_oxygen_saturation_percent,'%')}</b></div></div>`:empty('Nenhuma avaliação registrada.')}</div></section>
  <section class="card section"><div class="section-head"><h2>Histórico de avaliações</h2></div>${evalRows?`<div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Protocolo</th><th>Peso</th><th>% gordura</th><th>Ações</th></tr></thead><tbody>${evalRows}</tbody></table></div>`:empty('Nenhuma avaliação no histórico.')}</section>
  <section class="card section"><div class="section-head"><h2>Fotos, laudos e arquivos</h2></div>${fileCards||empty('Nenhum arquivo vinculado.')}</section>`, 'assessees');
}

async function signedFileCards(files){
  if(!files.length)return '';
  const rendered=[];
  for(const f of files){
    const {data}=await supabase.storage.from('assessment-files').createSignedUrl(f.storage_path,900);
    const url=data?.signedUrl||'#'; const isImage=f.mime_type?.startsWith('image/');
    rendered.push(`<article class="file-card"><div class="file-thumb">${isImage?`<img src="${url}" alt="${esc(f.file_name)}">`:'<div class="pdf">📄</div>'}</div><div class="file-name">${esc(f.file_name||'Arquivo')}</div><a class="btn btn-secondary btn-sm btn-block" href="${url}" target="_blank" rel="noreferrer">Abrir arquivo</a></article>`);
  }
  return `<div class="file-grid">${rendered.join('')}</div>`;
}

function startWizard(assessee){
  state.wizard={step:1,assessee,photos:[],reports:[],data:{assessed_at:today(),weight_kg:'',height_cm:'',systolic_bp_mmhg:'',diastolic_bp_mmhg:'',resting_heart_rate_bpm:'',blood_oxygen_saturation_percent:'',assessment_protocol:'',body_fat_percent:'',lean_mass_kg:'',fat_mass_kg:'',client_summary:'',...Object.fromEntries(circFields.map(([k])=>[k,'']))}};
  go('/admin/avaliacao/fluxo');
}
async function wizardEntry(){
  await loadAssessees(true);
  return appShell(`<div class="topbar"><div><p class="eyebrow">Modo avaliação</p><h1>Quem será avaliado?</h1><p class="muted">Selecione um cadastro existente ou crie um novo.</p></div><button class="btn btn-primary" data-go="/admin/avaliado/novo">＋ Novo avaliado</button></div><section class="card"><div class="toolbar"><input class="input search" id="wizard-search" placeholder="Pesquisar nome, ID, e-mail ou telefone"></div><div id="wizard-list">${wizardList(state.assessees)}</div></section>`, 'assessees');
}
function wizardList(items){return items.length?`<div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>Nome</th><th>Perfil</th><th></th></tr></thead><tbody>${items.map(a=>`<tr><td><span class="code">${esc(a.public_id)}</span></td><td><b>${esc(a.full_name)}</b><div class="small muted">${esc(a.email||'')}</div></td><td><span class="badge">${esc(a.athletic_profile)}</span></td><td><button class="btn btn-primary btn-sm" data-start-wizard="${a.id}">Selecionar</button></td></tr>`).join('')}</tbody></table></div>`:empty('Nenhum avaliado encontrado.')}

function wizardPage(){
  if(!state.wizard){go('/admin/avaliacao/nova');return loading()}
  const w=state.wizard,d=w.data;
  const titles=['Dados iniciais','Saúde','Circunferências','BodyMetrix','Fotos','Laudos','Revisão'];
  const subtitles=['Peso e altura antes da coleta.','Pressão, frequência cardíaca e oxigenação antes do escaneamento.','Registre as medidas em centímetros.','Informe protocolo e resultados da composição corporal.','Adicione as fotos padronizadas de evolução.','Anexe um ou mais PDFs ou arquivos do BodyMetrix.','Confira tudo antes de finalizar o atendimento.'];
  return `<div class="wizard-page"><header class="wizard-header"><div class="wizard-header-inner"><img src="./jump-metrics-logo.png"><div><b>${esc(w.assessee.full_name)}</b><div class="small muted">${esc(w.assessee.public_id)} • ${esc(w.assessee.athletic_profile)}</div></div><button class="btn btn-secondary btn-sm" data-cancel-wizard>Fechar</button></div></header>
  <div class="wizard-progress"><div class="steps">${titles.map((t,i)=>`<div class="step ${i+1===w.step?'active':i+1<w.step?'done':''}">${i+1}. ${t}</div>`).join('')}</div></div>
  <main class="wizard-main"><section class="wizard-card"><div class="wizard-title"><p class="eyebrow">Etapa ${w.step} de 7</p><h1>${titles[w.step-1]}</h1><p>${subtitles[w.step-1]}</p></div>${wizardStepContent()}</section></main>
  <footer class="wizard-footer"><div class="wizard-footer-inner"><button class="btn btn-secondary" id="wizard-prev" ${w.step===1?'disabled':''}>← Voltar</button><button class="btn btn-primary" id="wizard-next">${w.step===7?'Finalizar atendimento':'Próximo →'}</button></div></footer></div>`;
}
function field(name,label,type='number',placeholder='') {const v=state.wizard.data[name]??'';return `<div class="field"><label>${label}</label><input class="input wizard-input" name="${name}" type="${type}" value="${esc(v)}" ${type==='number'?'step="0.01" min="0"':''} placeholder="${placeholder}"></div>`}
function selectField(name,label,opts){const v=state.wizard.data[name]||'';return `<div class="field"><label>${label}</label><select class="select wizard-input" name="${name}"><option value="">Selecione</option>${opts.map(o=>`<option value="${esc(o)}" ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`}
function ratio(a,b){const x=num(state.wizard.data[a]),y=num(state.wizard.data[b]);return x&&y?(x/y).toFixed(2):'—'}
function wizardStepContent(){
  const w=state.wizard,d=w.data;
  if(w.step===1)return `<div class="measure-grid">${field('assessed_at','Data da avaliação','date')}${field('weight_kg','Peso (kg)')}${field('height_cm','Altura (cm)')}</div><div class="ratio-grid"><div class="ratio"><span>IMC calculado</span><b id="calc-imc">${num(d.weight_kg)&&num(d.height_cm)?(num(d.weight_kg)/(num(d.height_cm)/100)**2).toFixed(1):'—'}</b></div></div>`;
  if(w.step===2)return `<div class="measure-grid">${field('systolic_bp_mmhg','Pressão sistólica (mmHg)')}${field('diastolic_bp_mmhg','Pressão diastólica (mmHg)')}${field('resting_heart_rate_bpm','FC de repouso (bpm)')}${field('blood_oxygen_saturation_percent','Oxigenação SpO₂ (%)')}</div><div class="alert alert-warn" style="margin-top:18px">Realize essas medidas com o avaliado em repouso e antes do escaneamento.</div>`;
  if(w.step===3)return `<div class="circ-grid">${circFields.map(([k,l])=>field(k,`${l} (cm)`)).join('')}</div><div class="ratio-grid"><div class="ratio"><span>Relação cintura/quadril</span><b id="calc-rcq">${ratio('waist_cm','hip_cm')}</b></div><div class="ratio"><span>Relação ombro/cintura</span><b id="calc-roc">${ratio('shoulder_cm','waist_cm')}</b></div><div class="ratio"><span>Relação cintura/altura</span><b id="calc-rca">${num(d.waist_cm)&&num(d.height_cm)?(num(d.waist_cm)/num(d.height_cm)).toFixed(2):'—'}</b></div></div>`;
  if(w.step===4)return `<div class="grid grid-2">${selectField('assessment_protocol','Protocolo utilizado',protocols)}${field('body_fat_percent','Percentual de gordura (%)')}${field('lean_mass_kg','Massa magra (kg)')}${field('fat_mass_kg','Massa gorda (kg)')}</div><div class="field" style="margin-top:16px"><label>Observações e orientação ao avaliado</label><textarea class="textarea wizard-input" name="client_summary">${esc(d.client_summary||'')}</textarea></div>`;
  if(w.step===5)return `<div class="grid grid-3"><label class="upload-zone"><div><div style="font-size:38px">📷</div><b>Foto de frente</b><p class="small muted">Selecione uma ou mais imagens.</p><input type="file" id="photos-front" accept="image/*" multiple></div></label><label class="upload-zone"><div><div style="font-size:38px">📷</div><b>Foto lateral</b><p class="small muted">Selecione uma ou mais imagens.</p><input type="file" id="photos-side" accept="image/*" multiple></div></label><label class="upload-zone"><div><div style="font-size:38px">📷</div><b>Foto de costas</b><p class="small muted">Selecione uma ou mais imagens.</p><input type="file" id="photos-back" accept="image/*" multiple></div></label></div><div id="photo-summary" class="alert alert-ok" style="margin-top:16px">${w.photos.length} foto(s) selecionada(s).</div>`;
  if(w.step===6)return `<label class="upload-zone"><div><div style="font-size:42px">📄</div><h3>Laudos e arquivos BodyMetrix</h3><p class="muted">PDF, imagem, CSV ou planilha. Você pode selecionar vários arquivos.</p><input type="file" id="reports" accept=".pdf,image/*,.csv,.xls,.xlsx" multiple></div></label><div id="report-summary" class="alert alert-ok" style="margin-top:16px">${w.reports.length} arquivo(s) selecionado(s).</div>`;
  return `<div class="review-list"><div class="review-item"><b>Avaliado</b><span>${esc(w.assessee.full_name)} • ${esc(w.assessee.public_id)}</span></div><div class="review-item"><b>Dados iniciais</b><span>${fmt(d.weight_kg,' kg')} • ${fmt(d.height_cm,' cm')}</span></div><div class="review-item"><b>Saúde</b><span>PA ${fmt(d.systolic_bp_mmhg)}/${fmt(d.diastolic_bp_mmhg)} • FC ${fmt(d.resting_heart_rate_bpm,' bpm')} • SpO₂ ${fmt(d.blood_oxygen_saturation_percent,'%')}</span></div><div class="review-item"><b>BodyMetrix</b><span>${esc(d.assessment_protocol||'Sem protocolo')} • gordura ${fmt(d.body_fat_percent,'%')} • massa magra ${fmt(d.lean_mass_kg,' kg')}</span></div><div class="review-item"><b>Arquivos</b><span>${w.photos.length} foto(s) • ${w.reports.length} laudo(s)/arquivo(s)</span></div></div><div class="alert alert-warn" style="margin-top:18px">Ao finalizar, a avaliação será salva, os arquivos serão enviados e o resultado ficará disponível no portal do avaliado.</div>`;
}
function syncWizardInputs(){document.querySelectorAll('.wizard-input').forEach(el=>{state.wizard.data[el.name]=el.value})}
function collectFiles(input,type){for(const file of input.files||[])state.wizard[type].push({file,photo_type:input.id==='photos-front'?'front':input.id==='photos-side'?'side':input.id==='photos-back'?'back':'bodymetrix'})}
async function finishWizard(){
  syncWizardInputs(); const w=state.wizard,d=w.data;
  const payload={organization_id:state.organizationId,assessee_id:w.assessee.id,assessed_at:d.assessed_at||today(),assessment_protocol:d.assessment_protocol||null,client_summary:d.client_summary||null};
  ['weight_kg','height_cm','systolic_bp_mmhg','diastolic_bp_mmhg','resting_heart_rate_bpm','blood_oxygen_saturation_percent','body_fat_percent','lean_mass_kg','fat_mass_kg',...circFields.map(x=>x[0])].forEach(k=>payload[k]=num(d[k]));
  const next=document.querySelector('#wizard-next'); next.disabled=true;next.textContent='Salvando e enviando arquivos...';
  const {data:evaluation,error}=await supabase.from('evaluations').insert(payload).select().single(); if(error)throw error;
  const all=[...w.photos,...w.reports];
  for(let i=0;i<all.length;i++){
    const item=all[i],file=item.file;
    if(file.size>25*1024*1024)throw new Error(`${file.name}: arquivo maior que 25 MB.`);
    const clean=file.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'-');
    const path=`${state.organizationId}/${w.assessee.id}/${evaluation.id}/${uid()}-${clean}`;
    const {error:upErr}=await supabase.storage.from('assessment-files').upload(path,file,{contentType:file.type,upsert:false}); if(upErr)throw upErr;
    const {error:dbErr}=await supabase.from('evaluation_photos').insert({organization_id:state.organizationId,assessee_id:w.assessee.id,evaluation_id:evaluation.id,photo_type:item.photo_type,storage_path:path,file_name:file.name,mime_type:file.type,file_size:file.size}); if(dbErr)throw dbErr;
  }
  const assessee=w.assessee; state.wizard=null;
  $app.innerHTML=`<div class="wizard-page"><main class="wizard-main"><section class="wizard-card success-screen"><div class="success-mark">✓</div><h1>Avaliação finalizada</h1><p class="muted">Os dados, fotos e laudos de ${esc(assessee.full_name)} foram organizados no histórico.</p><div class="top-actions" style="justify-content:center;margin-top:24px"><button class="btn btn-secondary" data-go="/admin/avaliado/${assessee.id}">Abrir histórico</button><button class="btn btn-secondary" data-send-access="${assessee.id}">Enviar acesso</button><button class="btn btn-primary" data-go="/admin/avaliacao/nova">Próximo avaliado</button></div></section></main></div>`;
  bindGlobal();
}

async function evaluationDetail(assesseeId,evaluationId){
  const [{data:a},{data:e,error},{data:files}]=await Promise.all([supabase.from('assessees').select('*').eq('id',assesseeId).single(),supabase.from('evaluations').select('*').eq('id',evaluationId).single(),supabase.from('evaluation_photos').select('*').eq('evaluation_id',evaluationId)]);if(error)throw error;
  const fileCards=await signedFileCards(files||[]);
  return appShell(`<div class="topbar"><div><p class="eyebrow">Avaliação • ${dateBR(e.assessed_at)}</p><h1>${esc(a.full_name)}</h1><p class="muted">${esc(e.assessment_protocol||'Protocolo não informado')}</p></div><div class="top-actions"><button class="btn btn-secondary" data-go="/admin/avaliado/${assesseeId}">Voltar</button><button class="btn btn-secondary" data-edit-evaluation="${evaluationId}" data-assessee="${assesseeId}">Editar</button><button class="btn btn-danger" data-delete-evaluation="${evaluationId}" data-assessee="${assesseeId}">Apagar</button></div></div>
  <section class="card"><div class="section-head"><h2>Composição e saúde</h2></div><div class="kv"><div><span>Peso</span><b>${fmt(e.weight_kg,' kg')}</b></div><div><span>Altura</span><b>${fmt(e.height_cm,' cm')}</b></div><div><span>% gordura</span><b>${fmt(e.body_fat_percent,'%')}</b></div><div><span>Massa magra</span><b>${fmt(e.lean_mass_kg,' kg')}</b></div><div><span>Massa gorda</span><b>${fmt(e.fat_mass_kg,' kg')}</b></div><div><span>Pressão arterial</span><b>${fmt(e.systolic_bp_mmhg)}/${fmt(e.diastolic_bp_mmhg)}</b></div><div><span>FC repouso</span><b>${fmt(e.resting_heart_rate_bpm,' bpm')}</b></div><div><span>SpO₂</span><b>${fmt(e.blood_oxygen_saturation_percent,'%')}</b></div></div></section>
  <section class="card section"><div class="section-head"><h2>Circunferências</h2></div><div class="kv">${circFields.map(([k,l])=>`<div><span>${l}</span><b>${fmt(e[k],' cm')}</b></div>`).join('')}</div></section>
  ${e.client_summary?`<section class="card section"><h2>Observações</h2><p>${esc(e.client_summary)}</p></section>`:''}<section class="card section"><div class="section-head"><h2>Arquivos vinculados</h2></div>${fileCards||empty('Nenhum arquivo vinculado.')}</section>`, 'assessees');
}

async function editEvaluation(assesseeId,evaluationId){
  const {data:e,error}=await supabase.from('evaluations').select('*').eq('id',evaluationId).single();if(error)throw error;
  return appShell(`<div class="topbar"><div><p class="eyebrow">Editar avaliação</p><h1>${dateBR(e.assessed_at)}</h1></div></div><section class="card"><form id="evaluation-edit-form" class="form" data-id="${evaluationId}" data-assessee="${assesseeId}"><div class="measure-grid">${editField(e,'assessed_at','Data','date')}${editField(e,'weight_kg','Peso (kg)')}${editField(e,'height_cm','Altura (cm)')}${editField(e,'systolic_bp_mmhg','Sistólica')}${editField(e,'diastolic_bp_mmhg','Diastólica')}${editField(e,'resting_heart_rate_bpm','FC repouso')}${editField(e,'blood_oxygen_saturation_percent','SpO₂ (%)')}${editField(e,'body_fat_percent','% gordura')}${editField(e,'lean_mass_kg','Massa magra')}${editField(e,'fat_mass_kg','Massa gorda')}</div><div class="circ-grid form-section">${circFields.map(([k,l])=>editField(e,k,`${l} (cm)`)).join('')}</div><div class="field form-section"><label>Protocolo</label><select class="select" name="assessment_protocol"><option value="">Selecione</option>${protocols.map(p=>`<option ${e.assessment_protocol===p?'selected':''}>${esc(p)}</option>`).join('')}</select></div><div class="field"><label>Observações</label><textarea class="textarea" name="client_summary">${esc(e.client_summary||'')}</textarea></div><div class="top-actions"><button type="button" class="btn btn-secondary" data-go="/admin/avaliado/${assesseeId}/avaliacao/${evaluationId}">Cancelar</button><button class="btn btn-primary">Salvar alterações</button></div></form></section>`, 'assessees');
}
function editField(e,k,l,t='number'){return `<div class="field"><label>${l}</label><input class="input" name="${k}" type="${t}" ${t==='number'?'step="0.01" min="0"':''} value="${esc(e[k]??'')}"></div>`}

async function clientPortal(){
  try { await supabase.rpc('claim_assessee_by_email'); } catch (_) {}
  const {data:rows,error}=await supabase.from('assessees').select('*').eq('account_user_id',state.user.id).limit(1);if(error)throw error; const a=rows?.[0];
  if(!a)return `<div class="client-page"><header class="client-header"><div class="container"><img src="./jump-metrics-logo.png"><button class="btn btn-secondary" id="logout">Sair</button></div></header><main class="container client-main"><section class="card">${empty('Ainda não encontramos uma avaliação vinculada a este e-mail. Confirme com o profissional se o mesmo e-mail foi usado no cadastro.')}</section></main></div>`;
  const [{data:evals},{data:files}]=await Promise.all([supabase.from('evaluations').select('*').eq('assessee_id',a.id).order('assessed_at',{ascending:false}),supabase.from('evaluation_photos').select('*').eq('assessee_id',a.id).order('created_at',{ascending:false})]);
  const latest=evals?.[0],previous=evals?.[1],fileCards=await signedFileCards(files||[]);
  const trend=(key,s='')=>{if(!latest||!previous||latest[key]==null||previous[key]==null)return '—';const diff=Number(latest[key])-Number(previous[key]);return `${diff>0?'+':''}${diff.toLocaleString('pt-BR',{maximumFractionDigits:2})}${s}`}
  const rowsHtml=(evals||[]).map(e=>`<tr><td>${dateBR(e.assessed_at)}</td><td>${esc(e.assessment_protocol||'—')}</td><td>${fmt(e.weight_kg,' kg')}</td><td>${fmt(e.body_fat_percent,'%')}</td><td>${fmt(e.lean_mass_kg,' kg')}</td><td>${fmt(e.waist_cm,' cm')}</td></tr>`).join('');
  return `<div class="client-page"><header class="client-header"><div class="container"><img src="./jump-metrics-logo.png"><button class="btn btn-secondary" id="logout">Sair</button></div></header><main class="container client-main"><section class="client-hero"><div><p class="eyebrow">Meu Jump Metrics</p><h1>${esc(a.full_name)}</h1><p class="muted">${esc(a.public_id)} • ${esc(a.athletic_profile)}</p></div><div><span class="badge">${evals?.length||0} avaliação(ões)</span></div></section>
  ${latest?`<section class="grid grid-4 section"><div class="stat"><span>Peso atual</span><b>${fmt(latest.weight_kg,' kg')}</b><div class="trend">Desde a anterior: ${trend('weight_kg',' kg')}</div></div><div class="stat"><span>Gordura corporal</span><b>${fmt(latest.body_fat_percent,'%')}</b><div class="trend">Desde a anterior: ${trend('body_fat_percent','%')}</div></div><div class="stat"><span>Massa magra</span><b>${fmt(latest.lean_mass_kg,' kg')}</b><div class="trend">Desde a anterior: ${trend('lean_mass_kg',' kg')}</div></div><div class="stat"><span>Cintura</span><b>${fmt(latest.waist_cm,' cm')}</b><div class="trend">Desde a anterior: ${trend('waist_cm',' cm')}</div></div></section>
  <section class="card section"><div class="section-head"><h2>Última avaliação • ${dateBR(latest.assessed_at)}</h2></div><div class="kv"><div><span>Protocolo</span><b>${esc(latest.assessment_protocol||'—')}</b></div><div><span>Pressão arterial</span><b>${fmt(latest.systolic_bp_mmhg)}/${fmt(latest.diastolic_bp_mmhg)}</b></div><div><span>FC repouso</span><b>${fmt(latest.resting_heart_rate_bpm,' bpm')}</b></div><div><span>SpO₂</span><b>${fmt(latest.blood_oxygen_saturation_percent,'%')}</b></div></div>${latest.client_summary?`<p style="margin-top:18px"><b>Observações do profissional:</b><br>${esc(latest.client_summary)}</p>`:''}</section>`:empty('Nenhuma avaliação disponível.')}
  <section class="card section"><div class="section-head"><h2>Histórico</h2></div>${rowsHtml?`<div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Protocolo</th><th>Peso</th><th>% gordura</th><th>Massa magra</th><th>Cintura</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`:empty('Nenhum histórico disponível.')}</section>
  <section class="card section"><div class="section-head"><h2>Fotos, laudos e arquivos</h2></div>${fileCards||empty('Nenhum arquivo disponível.')}</section></main></div>`;
}

async function render(){
  try{
    const r=route();
    if(r==='/'){$app.innerHTML=publicHome();bindGlobal();return}
    if(r==='/login'){$app.innerHTML=authPage();bindGlobal();return}
    if(r==='/nova-senha'){$app.innerHTML=resetPasswordPage();bindGlobal();return}
    if(r==='/redirect'){$app.innerHTML=await redirectPage();bindGlobal();return}
    if(r.startsWith('/admin')){
      if(!guardProfessional())return;
      $app.innerHTML=loading('Carregando painel...');
      if(r==='/admin')$app.innerHTML=await loadDashboard();
      else if(r==='/admin/avaliados')$app.innerHTML=await assesseesPage();
      else if(r==='/admin/avaliado/novo')$app.innerHTML=assesseeForm();
      else if(r==='/admin/avaliacao/nova')$app.innerHTML=await wizardEntry();
      else if(r==='/admin/avaliacao/fluxo')$app.innerHTML=wizardPage();
      else {
        const parts=r.split('/').filter(Boolean);
        if(parts[1]==='avaliado'&&parts[3]==='editar'){
          const {data,error}=await supabase.from('assessees').select('*').eq('id',parts[2]).single();if(error)throw error;$app.innerHTML=assesseeForm(data);
        }else if(parts[1]==='avaliado'&&parts[3]==='avaliacao'&&parts[5]==='editar')$app.innerHTML=await editEvaluation(parts[2],parts[4]);
        else if(parts[1]==='avaliado'&&parts[3]==='avaliacao')$app.innerHTML=await evaluationDetail(parts[2],parts[4]);
        else if(parts[1]==='avaliado')$app.innerHTML=await assesseeDetail(parts[2]);
        else $app.innerHTML=await loadDashboard();
      }
      bindGlobal();return;
    }
    if(r==='/meus-resultados'){
      if(!state.user){go('/login');return}$app.innerHTML=loading('Carregando resultados...');$app.innerHTML=await clientPortal();bindGlobal();return;
    }
    go('/');
  }catch(e){console.error(e);$app.innerHTML=`<div class="container" style="padding:40px"><div class="card"><h2>Não foi possível carregar</h2><div class="alert alert-error">${esc(e.message)}</div><button class="btn btn-secondary" data-go="/">Voltar</button></div></div>`;bindGlobal();}
}

function updateWizardCalculations(){
  if(!state.wizard) return;
  const d=state.wizard.data;
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  const weight=num(d.weight_kg),height=num(d.height_cm),waist=num(d.waist_cm),hip=num(d.hip_cm),shoulder=num(d.shoulder_cm);
  set('calc-imc',weight&&height?(weight/(height/100)**2).toFixed(1):'—');
  set('calc-rcq',waist&&hip?(waist/hip).toFixed(2):'—');
  set('calc-roc',shoulder&&waist?(shoulder/waist).toFixed(2):'—');
  set('calc-rca',waist&&height?(waist/height).toFixed(2):'—');
}

function bindGlobal(){
  document.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>go(el.dataset.go));
  document.querySelectorAll('[data-auth-tab]').forEach(el=>el.onclick=()=>go(`/login${el.dataset.authTab==='signup'?'?tab=signup':''}`));
  document.querySelector('#auth-form')?.addEventListener('submit',e=>{e.preventDefault();authSubmit(e.currentTarget)});
  document.querySelector('#forgot-password')?.addEventListener('click',forgotPassword);
  document.querySelector('#reset-form')?.addEventListener('submit',async e=>{e.preventDefault();const p=new FormData(e.currentTarget).get('password');const {error}=await supabase.auth.updateUser({password:p});document.querySelector('#reset-message').innerHTML=error?`<div class="alert alert-error">${esc(error.message)}</div>`:'<div class="alert alert-ok">Senha atualizada. Você já pode entrar.</div>';if(!error)setTimeout(()=>go('/login'),1200)});
  document.querySelector('#logout')?.addEventListener('click',async()=>{await supabase.auth.signOut();go('/')});
  document.querySelector('#assessee-form')?.addEventListener('submit',async e=>{e.preventDefault();try{await saveAssessee(e.currentTarget)}catch(err){document.querySelector('#form-message').innerHTML=`<div class="alert alert-error">${esc(err.message)}</div>`}});
  const search=document.querySelector('#assessee-search');if(search)search.oninput=()=>{const q=search.value.toLowerCase();const rows=state.assessees.filter(a=>[a.full_name,a.email,a.phone,a.public_id].some(v=>String(v||'').toLowerCase().includes(q)));document.querySelector('#assessees-table').innerHTML=assesseesTable(rows);document.querySelector('#result-count').textContent=`${rows.length} registros`;bindGlobal()};
  const wsearch=document.querySelector('#wizard-search');if(wsearch)wsearch.oninput=()=>{const q=wsearch.value.toLowerCase();const rows=state.assessees.filter(a=>[a.full_name,a.email,a.phone,a.public_id].some(v=>String(v||'').toLowerCase().includes(q)));document.querySelector('#wizard-list').innerHTML=wizardList(rows);bindGlobal()};
  document.querySelectorAll('[data-start-wizard]').forEach(el=>el.onclick=async()=>{await loadAssessees();const a=state.assessees.find(x=>x.id===el.dataset.startWizard);if(a)startWizard(a)});
  document.querySelectorAll('.wizard-input').forEach(el=>el.oninput=()=>{state.wizard.data[el.name]=el.value;updateWizardCalculations()});
  ['photos-front','photos-side','photos-back'].forEach(id=>{const el=document.querySelector(`#${id}`);if(el)el.onchange=()=>{collectFiles(el,'photos');document.querySelector('#photo-summary').textContent=`${state.wizard.photos.length} foto(s) selecionada(s).`}});
  const reports=document.querySelector('#reports');if(reports)reports.onchange=()=>{collectFiles(reports,'reports');document.querySelector('#report-summary').textContent=`${state.wizard.reports.length} arquivo(s) selecionado(s).`};
  document.querySelector('#wizard-prev')?.addEventListener('click',()=>{syncWizardInputs();if(state.wizard.step>1){state.wizard.step--;render()}});
  document.querySelector('#wizard-next')?.addEventListener('click',async()=>{try{syncWizardInputs();if(state.wizard.step<7){state.wizard.step++;render()}else await finishWizard()}catch(e){toast(e.message,'error');const b=document.querySelector('#wizard-next');if(b){b.disabled=false;b.textContent='Finalizar atendimento'}}});
  document.querySelector('[data-cancel-wizard]')?.addEventListener('click',()=>{if(confirm('Fechar a avaliação? Os dados ainda não salvos serão perdidos.')){state.wizard=null;go('/admin')}});
  document.querySelectorAll('[data-delete-assessee]').forEach(el=>el.onclick=async()=>{if(!confirm('Apagar este avaliado, todas as avaliações e arquivos vinculados?'))return;const id=el.dataset.deleteAssessee;try{const {data:files}=await supabase.from('evaluation_photos').select('storage_path').eq('assessee_id',id);if(files?.length)await supabase.storage.from('assessment-files').remove(files.map(f=>f.storage_path));const {error}=await supabase.from('assessees').delete().eq('id',id);if(error)throw error;state.assessees=[];toast('Avaliado apagado.');go('/admin/avaliados')}catch(e){toast(e.message,'error')}});
  document.querySelectorAll('[data-delete-evaluation]').forEach(el=>el.onclick=async()=>{if(!confirm('Apagar esta avaliação e seus arquivos?'))return;const id=el.dataset.deleteEvaluation,a=el.dataset.assessee;try{const {data:files}=await supabase.from('evaluation_photos').select('storage_path').eq('evaluation_id',id);if(files?.length)await supabase.storage.from('assessment-files').remove(files.map(f=>f.storage_path));const {error}=await supabase.from('evaluations').delete().eq('id',id);if(error)throw error;toast('Avaliação apagada.');go(`/admin/avaliado/${a}`)}catch(e){toast(e.message,'error')}});
  document.querySelectorAll('[data-edit-evaluation]').forEach(el=>el.onclick=()=>go(`/admin/avaliado/${el.dataset.assessee}/avaliacao/${el.dataset.editEvaluation}/editar`));
  document.querySelector('#evaluation-edit-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,fd=new FormData(form),payload={assessment_protocol:fd.get('assessment_protocol')||null,client_summary:fd.get('client_summary')||null};['assessed_at','weight_kg','height_cm','systolic_bp_mmhg','diastolic_bp_mmhg','resting_heart_rate_bpm','blood_oxygen_saturation_percent','body_fat_percent','lean_mass_kg','fat_mass_kg',...circFields.map(x=>x[0])].forEach(k=>payload[k]=k==='assessed_at'?fd.get(k):num(fd.get(k)));const {error}=await supabase.from('evaluations').update(payload).eq('id',form.dataset.id);if(error)toast(error.message,'error');else{toast('Avaliação atualizada.');go(`/admin/avaliado/${form.dataset.assessee}/avaliacao/${form.dataset.id}`)}});
  document.querySelectorAll('[data-send-access]').forEach(el=>el.onclick=async()=>{const id=el.dataset.sendAccess;const {data:a}=await supabase.from('assessees').select('*').eq('id',id).single();if(!a?.email){toast('Cadastre o e-mail do avaliado antes de enviar o acesso.','error');return}const text=`Olá, ${a.full_name}! Seus resultados do Jump Metrics estão disponíveis. Acesse ${location.origin}${location.pathname}#/login e crie sua conta usando este mesmo e-mail: ${a.email}`;const phone=(a.phone||'').replace(/\D/g,'');window.open(`https://wa.me/${phone?`55${phone.replace(/^55/,'')}`:''}?text=${encodeURIComponent(text)}`,'_blank')});
}

initialize();
