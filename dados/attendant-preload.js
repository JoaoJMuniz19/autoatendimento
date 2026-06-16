(function(){'use strict';
const A=window.JC_APP;const params=new URLSearchParams(location.search);let cached={};try{cached=JSON.parse(sessionStorage.getItem('jc_apk_access')||'{}')}catch(e){}
const publicSlug=(params.get('cliente')||'').toLowerCase().replace(/[^a-z0-9-]/g,'');const configMode=params.get('mode')==='config';const cachedSlug=cached?.attendant?.slug||cached?.profile?.username||'';const slug=publicSlug||cachedSlug||'jc-apk-tv';
window.JC_ATTENDANT_CONTEXT={slug,configMode,storageKey:`demo_ai_settings_v1_${slug}`,leadsKey:`demo_ai_leads_v1_${slug}`,access:null,signature:null,testMode:cached?.mode==='test'};
const overlay=document.createElement('div');overlay.id='jc_attendant_loading';overlay.style.cssText='position:fixed;inset:0;z-index:999999999;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#06111d,#0b2637);color:#fff;font-family:Arial,sans-serif;padding:20px;text-align:center';overlay.innerHTML='<div><div style="font-size:38px">🤖</div><h2>Carregando Atendente Virtual</h2><p id="jc_attendant_loading_text" style="color:#aebbc3">Buscando as configurações corretas...</p></div>';document.body.appendChild(overlay);
function signatureSettings(sig){sig=sig||{};return {developerShow:sig.show!==false,developerName:sig.name||'JC-APK TV',developerWhatsapp:String(sig.whatsapp||'5555997234936').replace(/\D/g,''),developerInstagram:sig.instagram||'',developerMessage:sig.message||'Desenvolvido por JC-APK TV'} }
function finish(){const el=document.getElementById('jc_attendant_loading');if(el)el.remove()}
function error(text){const el=document.getElementById('jc_attendant_loading_text');if(el)el.innerHTML=text}
window.JC_ATTENDANT_BOOT_PROMISE=(async()=>{
  if(!A?.ready||!A.client){error('Configure o novo Supabase para carregar os dados compartilhados.');setTimeout(finish,1800);return}
  try{
    let settings=null,signature=null,access=null,updated='';
    if(configMode){
      if(window.JC_ATTENDANT_CONTEXT.testMode){setTimeout(finish,500);return}
      const {data:{session}}=await A.client.auth.getSession();
      if(!session){error('Faça login no painel do cliente antes de configurar.<br><a style="color:#25d366" href="'+(A.cfg.panelUrl||'../geradores/')+'">Ir para o painel</a>');return}
      access=await A.myAccess();window.JC_ATTENDANT_CONTEXT.access=access;
      const allowed=access?.profile?.role==='admin'||access?.profile?.role==='test'||access?.profile?.attendant_enabled||access?.permissions?.['attendant.open'];
      if(!allowed){error('O Atendente Virtual não está liberado para este usuário.<br><a style="color:#25d366" href="'+(A.cfg.panelUrl||'../geradores/')+'">Voltar ao painel</a>');return}
      if(access?.profile?.role==='test'){window.JC_ATTENDANT_CONTEXT.testMode=true;setTimeout(finish,500);return}
      const [attRes,sigRes]=await Promise.all([
        A.client.from('attendant_profiles').select('slug,public_settings,published,config_password_changed_at,updated_at').eq('user_id',access.profile.id).single(),
        A.client.from('app_settings').select('value').eq('key','signature').single()
      ]);
      if(attRes.error)throw attRes.error;if(sigRes.error)throw sigRes.error;
      window.JC_ATTENDANT_CONTEXT.slug=attRes.data.slug;window.JC_ATTENDANT_CONTEXT.storageKey=`demo_ai_settings_v1_${attRes.data.slug}`;window.JC_ATTENDANT_CONTEXT.leadsKey=`demo_ai_leads_v1_${attRes.data.slug}`;
      settings=attRes.data.public_settings||{};signature=sigRes.data?.value||{};updated=attRes.data.updated_at||'';
    }else{
      const {data,error:rpcError}=await A.client.rpc('get_public_attendant',{p_slug:slug});
      if(rpcError)throw rpcError;
      if(!data){error('Atendente não encontrado, não publicado ou temporariamente indisponível.');return}
      settings=data.settings||{};signature=data.signature||{};updated=data.updated_at||'';
    }
    window.JC_ATTENDANT_CONTEXT.signature=signature;
    const merged=Object.assign({},settings,signatureSettings(signature));
    const key=window.JC_ATTENDANT_CONTEXT.storageKey;let old={};try{old=JSON.parse(localStorage.getItem(key)||'{}')}catch(e){}
    const next=JSON.stringify(merged),prev=JSON.stringify(old);
    if(prev!==next){localStorage.setItem(key,next);const mark='jc_att_reload_'+window.JC_ATTENDANT_CONTEXT.slug;const last=sessionStorage.getItem(mark);if(last!==updated){sessionStorage.setItem(mark,updated||String(Date.now()));location.reload();return}}
    setTimeout(finish,250);
  }catch(e){console.error(e);error('Não foi possível carregar a atendente: '+(e.message||e));}
})();
})();
