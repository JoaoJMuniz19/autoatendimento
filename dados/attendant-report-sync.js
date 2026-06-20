(function(){
  'use strict';
  const A=window.JC_APP,ctx=window.JC_ATTENDANT_CONTEXT||{};
  if(!A?.client||!ctx.leadsKey||!ctx.slug)return;
  const syncKey='jc_attendant_reports_synced_'+ctx.slug;
  let running=false,pending=false;
  function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'')||fallback;}catch(e){return fallback;}}
  function syncedSet(){return new Set(readJson(syncKey,[]));}
  function sourceId(item,index){return String(item?.id||item?.leadId||item?.code||`${item?.createdAt||item?.created_at||Date.now()}_${index}`).slice(0,160);}
  async function syncReports(){
    if(running){pending=true;return;}
    running=true;
    try{
      await(window.JC_ATTENDANT_BOOT_PROMISE||Promise.resolve());
      if(window.JC_ATTENDANT_CONTEXT?.error)return;
      const leads=readJson(ctx.leadsKey,[]);
      if(!Array.isArray(leads)||!leads.length)return;
      const done=syncedSet();let changed=false;
      for(let i=0;i<leads.length;i++){
        const item=leads[i]||{},id=sourceId(item,i);
        if(done.has(id))continue;
        const payload=Object.assign({},item,{_attendant_slug:ctx.slug});
        const {data,error}=await A.client.rpc('record_attendant_report',{p_slug:ctx.slug,p_source_id:id,p_payload:payload});
        if(error){console.warn('[JC Relatórios] Falha ao registrar',error);break;}
        if(data){done.add(id);changed=true;}
      }
      if(changed)localStorage.setItem(syncKey,JSON.stringify([...done].slice(-3000)));
    }catch(e){console.warn('[JC Relatórios] Sincronização indisponível',e);}
    finally{running=false;if(pending){pending=false;setTimeout(syncReports,200);}}
  }
  const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){const result=original.apply(this,arguments);if(this===localStorage&&key===ctx.leadsKey)setTimeout(syncReports,50);return result;};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(syncReports,500),{once:true});else setTimeout(syncReports,500);
  window.addEventListener('online',syncReports);
})();
