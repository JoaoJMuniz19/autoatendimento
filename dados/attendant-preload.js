(function(){
  'use strict';

  const A=window.JC_APP;
  const params=new URLSearchParams(location.search);
  let cached={};
  try{ cached=JSON.parse(sessionStorage.getItem('jc_apk_access')||'{}'); }catch(e){}

  const publicSlug=(params.get('cliente')||'').toLowerCase().replace(/[^a-z0-9-]/g,'');
  const configMode=params.get('mode')==='config';
  const previewMode=params.get('preview')==='admin';
  const cachedSlug=cached?.attendant?.slug||cached?.profile?.username||'';
  const slug=publicSlug||cachedSlug||'jc-apk-tv';

  window.JC_ATTENDANT_CONTEXT={
    slug,
    configMode,
    previewMode,
    adminTarget:false,
    targetUserId:null,
    storageKey:`demo_ai_settings_v1_${slug}`,
    leadsKey:`demo_ai_leads_v1_${slug}`,
    access:null,
    signature:null,
    testMode:cached?.mode==='test',
    ready:false,
    error:null
  };

  const ctx=window.JC_ATTENDANT_CONTEXT;
  const overlay=document.createElement('div');
  overlay.id='jc_attendant_loading';
  overlay.style.cssText='position:fixed;inset:0;z-index:999999999;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#06111d,#0b2637);color:#fff;font-family:Arial,sans-serif;padding:20px;text-align:center';
  overlay.innerHTML='<div><div style="font-size:38px">🤖</div><h2>Carregando Atendente Virtual</h2><p id="jc_attendant_loading_text" style="color:#aebbc3">Buscando as configurações corretas...</p></div>';
  document.body.appendChild(overlay);

  function signatureSettings(sig){
    sig=sig||{};
    return {
      developerShow:sig.show!==false,
      developerName:sig.name||'JC-APK TV',
      developerWhatsapp:String(sig.whatsapp||'5555997234936').replace(/\D/g,''),
      developerInstagram:sig.instagram||'',
      developerMessage:sig.message||'Desenvolvido por JC-APK TV'
    };
  }
  function finish(){ const el=document.getElementById('jc_attendant_loading'); if(el)el.remove(); }
  function showError(text,technical){
    ctx.error=technical||text;
    const el=document.getElementById('jc_attendant_loading_text');
    if(el)el.innerHTML=text;
  }
  function setContextSlug(value){
    const clean=String(value||'').toLowerCase().replace(/[^a-z0-9-]/g,'');
    if(!clean) return;
    ctx.slug=clean;
    ctx.storageKey=`demo_ai_settings_v1_${clean}`;
    ctx.leadsKey=`demo_ai_leads_v1_${clean}`;
  }
  function refreshCachedAccess(access){
    try{
      const next=Object.assign({},cached,{
        profile:access?.profile||cached.profile||{},
        attendant:access?.attendant||cached.attendant||{},
        permissions:access?.permissions||cached.permissions||{},
        general:access?.general||cached.general||{}
      });
      sessionStorage.setItem('jc_apk_access',JSON.stringify(next));
      cached=next;
    }catch(e){}
  }
  async function authenticatedAccess(){
    const {data:{session},error}=await A.client.auth.getSession();
    if(error)throw error;
    if(!session)return null;
    return A.myAccess();
  }

  window.JC_ATTENDANT_BOOT_PROMISE=(async()=>{
    if(!A?.ready||!A.client){
      showError('Não foi possível conectar ao Supabase.<br>Confira <b>dados/supabase-config.js</b> e se a biblioteca do Supabase carregou.');
      return false;
    }

    try{
      let settings=null,signature=null,updated='';

      if(previewMode){
        if(!publicSlug){showError('A prévia precisa do identificador do cliente.');return false;}
        const access=await authenticatedAccess();
        if(access?.profile?.role!=='admin'){showError('Esta prévia é restrita ao administrador.');return false;}
        ctx.access=access;ctx.adminTarget=true;
        const raw=localStorage.getItem('jc_attendant_admin_preview_'+publicSlug);
        if(!raw){showError('A prévia expirou ou não foi preparada. Volte ao painel de atendentes.');return false;}
        const draft=JSON.parse(raw);
        if(Number(draft.expiresAt||0)<Date.now()){localStorage.removeItem('jc_attendant_admin_preview_'+publicSlug);showError('A prévia expirou. Gere uma nova no painel de atendentes.');return false;}
        const sigRes=await A.client.from('app_settings').select('value').eq('key','signature').maybeSingle();
        if(sigRes.error)throw sigRes.error;
        setContextSlug(publicSlug);
        settings=draft.settings||{};
        signature=sigRes.data?.value||{};
        updated='preview-'+String(draft.createdAt||Date.now());
      }else if(configMode){
        if(ctx.testMode){ ctx.ready=true; setTimeout(finish,250); return true; }

        const access=await authenticatedAccess();
        if(!access){
          showError('Faça login no painel do cliente antes de configurar.<br><a style="color:#25d366" href="'+(A.cfg.panelUrl||'../geradores/')+'">Ir para o painel</a>');
          return false;
        }
        ctx.access=access;
        refreshCachedAccess(access);
        if(access?.profile?.role==='test'){ ctx.testMode=true; ctx.ready=true; setTimeout(finish,250); return true; }

        const isAdmin=access?.profile?.role==='admin';
        const canConfigure=isAdmin||Boolean(access?.permissions?.['attendant.configure']);
        if(!canConfigure){
          showError('A configuração completa não está liberada para este usuário.<br><a style="color:#25d366" href="'+(A.cfg.panelUrl||'../geradores/')+'">Voltar ao painel</a>');
          return false;
        }

        let attQuery=A.client.from('attendant_profiles').select('user_id,slug,public_settings,published,config_password_changed_at,updated_at');
        if(isAdmin&&publicSlug){
          attQuery=attQuery.eq('slug',publicSlug);
          ctx.adminTarget=true;
        }else{
          attQuery=attQuery.eq('user_id',access.profile.id);
        }
        const [attRes,sigRes]=await Promise.all([
          attQuery.maybeSingle(),
          A.client.from('app_settings').select('value').eq('key','signature').maybeSingle()
        ]);
        if(attRes.error) throw attRes.error;
        if(sigRes.error) throw sigRes.error;
        if(!attRes.data){
          showError('O perfil da atendente não foi encontrado.<br>Confira o cliente no novo painel de atendentes.');
          return false;
        }

        ctx.targetUserId=attRes.data.user_id;
        setContextSlug(attRes.data.slug);
        if(!ctx.adminTarget&&access.attendant) access.attendant.slug=attRes.data.slug;
        if(!ctx.adminTarget)refreshCachedAccess(access);
        settings=attRes.data.public_settings||{};
        signature=sigRes.data?.value||{};
        updated=attRes.data.updated_at||'';
      }else{
        if(!publicSlug){
          showError('Link incompleto. Use o endereço público com <b>?cliente=identificador</b>.');
          return false;
        }
        const {data,error:rpcError}=await A.client.rpc('get_public_attendant',{p_slug:publicSlug});
        if(rpcError) throw rpcError;
        if(!data){
          showError('Atendente não encontrado, ainda não publicado ou acesso temporariamente indisponível.');
          return false;
        }
        setContextSlug(data.slug||publicSlug);
        settings=data.settings||{};
        signature=data.signature||{};
        updated=data.updated_at||'';
      }

      ctx.signature=signature;
      const merged=Object.assign({},settings,signatureSettings(signature));
      const key=ctx.storageKey;
      let old={};
      try{ old=JSON.parse(localStorage.getItem(key)||'{}'); }catch(e){}
      const next=JSON.stringify(merged);
      const prev=JSON.stringify(old);

      if(prev!==next){
        localStorage.setItem(key,next);
        const mark='jc_att_reload_'+ctx.slug+(ctx.previewMode?'_preview':'');
        const version=updated||next;
        const last=sessionStorage.getItem(mark);
        if(last!==version){
          sessionStorage.setItem(mark,version);
          location.reload();
          return false;
        }
      }

      ctx.ready=true;
      setTimeout(finish,150);
      return true;
    }catch(e){
      console.error('[JC Atendente] Falha ao carregar:',e);
      showError('Não foi possível carregar a atendente.<br><small>'+(e.message||e)+'</small>',e);
      return false;
    }
  })();
})();
