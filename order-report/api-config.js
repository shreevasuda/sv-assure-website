/* Portal API runs on a dedicated same-site subdomain so secure session cookies work reliably.
   Keep this hostname aligned with the custom domain attached to the API Worker. */
(function(){
 const meta=document.querySelector('meta[name="sv-assure-api-base"]');
 const base=(window.SVA_API_BASE||meta?.content||'https://api.svassure.com').replace(/\/$/,'');
 window.svaApi=function(path,options={}){
  return fetch(base+path,{...options,credentials:'include'});
 };
})();
