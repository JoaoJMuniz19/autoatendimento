(function(){
  'use strict';
  const ctx=window.JC_ATTENDANT_CONTEXT||{};
  if(!ctx.configMode)return;
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  function enhance(){
    const title=$('.admin-head h2');if(title)title.textContent=ctx.adminTarget?'Configuração completa da atendente':'Configuração completa da minha atendente';
    const subtitle=$('.admin-head div > div');
    const leadTab=$('.tab[data-tab="leads"]'),settingsTab=$('.tab[data-tab="settings"]'),leadsPanel=$('#panel-leads'),settingsPanel=$('#panel-settings');
    if(leadTab)leadTab.remove();if(leadsPanel)leadsPanel.remove();
    if(settingsTab){settingsTab.classList.add('active');settingsTab.textContent='Configuração completa';}
    if(settingsPanel)settingsPanel.classList.add('active');
    const reset=$('#resetDemo');if(reset)reset.style.display='none';
    const notice=$('#panel-settings > .notice');if(notice)notice.innerHTML='<strong>Painel completo organizado</strong><br>Abra uma categoria por vez. Os dados técnicos, a imagem do teste e a área de desenvolvedor ficam protegidos no painel administrativo.';
    const sections=$$('#settingsSections .settings-section');
    sections.forEach((section,index)=>{section.open=index===0;section.addEventListener('toggle',()=>{if(!section.open)return;sections.forEach(other=>{if(other!==section)other.open=false;});});});
    const actions=$('.settings-actions-sticky');if(actions){const back=document.createElement('a');back.href=new URL('minha-atendente.html',window.JC_APP?.rootUrl||location.href).href;back.textContent='← Minha Atendente';back.className='ghost-btn';back.style.textDecoration='none';actions.prepend(back);}
    const style=document.createElement('style');style.textContent=`
      #panel-settings{max-width:1080px;margin:auto}.settings-section{border-radius:16px!important;overflow:hidden}.settings-section>summary{padding:15px!important}.settings-section-body{padding:15px!important}.assistant-media-picker{display:grid;gap:8px}.assistant-media-picker input[type=url],.assistant-media-picker input[type=file]{width:100%;min-width:0}.settings-fields{gap:10px!important}.settings-actions-sticky{gap:8px!important}.settings-actions-sticky>*{min-height:42px}@media(max-width:700px){.admin-shell{border-radius:0!important;max-height:100dvh!important;height:100dvh}.admin-content{padding:10px!important}.settings-section-body{padding:11px!important}}
    `;document.head.appendChild(style);
    const adminBtn=$('#adminBtn');if(adminBtn){adminBtn.title='Abrir configuração completa';const txt=adminBtn.querySelector('.promo-text');if(txt)txt.textContent='Configurar';}
  }
  async function ready(){try{await(window.JC_ATTENDANT_BOOT_PROMISE||Promise.resolve());}catch(e){}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();}
  ready();
})();
