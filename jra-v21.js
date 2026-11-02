const $=id=>document.getElementById(id);
async function api(url,body){const response=await fetch(url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},credentials:'same-origin',...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||'API error');return data;}
function bind(id,fn){$(id)?.addEventListener('click',async()=>{try{$('v21out').textContent=JSON.stringify(await fn(),null,2)}catch(e){$('v21out').textContent='エラー: '+e.message}})}
bind('v21import',()=>api('/api/v21/import',{races:JSON.parse($('v21rows').value),license:{commercialUseAuthorized:$('v21license').checked,provider:$('v21provider').value,termsReference:$('v21terms').value}}));
bind('v21list',()=>api('/api/v21/datasets'));
bind('v21eval',()=>api('/api/v21/evaluate',{id:$('v21id').value.trim()}));
bind('v21compare',()=>api('/api/v21/challenger',{oldId:$('v21old').value.trim(),newId:$('v21new').value.trim()}));
