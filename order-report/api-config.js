/* The dedicated API Worker is connected to api.svassure.com in Cloudflare.
   Keep the API on its own subdomain; do not route the main website host to this Worker. */
(function(){
 const meta=document.querySelector('meta[name="sv-assure-api-base"]');
 const base=(window.SVA_API_BASE||meta?.content||'https://api.svassure.com').replace(/\/$/,'');
 window.svaApi=function(path,options={}){
  return fetch(base+path,{...options,credentials:'include'});
 };
})();
