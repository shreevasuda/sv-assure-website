/* Portal API runs on a dedicated same-site subdomain so secure session cookies work reliably.
   Configure portal-api.svassure.com as a custom domain on the dedicated Cloudflare Worker before testing.
   Do not point this at workers.dev for browser sign-in: third-party cookie restrictions may block sessions. */
(function(){
 const meta=document.querySelector('meta[name="sv-assure-api-base"]');
 const base=(window.SVA_API_BASE||meta?.content||'https://portal-api.svassure.com').replace(/\/$/,'');
 window.svaApi=function(path,options={}){
  return fetch(base+path,{...options,credentials:'include'});
 };
})();
