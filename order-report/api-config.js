/* Central API URL switch. Leave empty for same-origin routing; set to the dedicated API Worker URL during preview testing. */
(function(){
 const meta=document.querySelector('meta[name="sv-assure-api-base"]');
 const base=(window.SVA_API_BASE||meta?.content||'').replace(/\/$/,'');
 window.svaApi=function(path,options={}){
  return fetch(base+path,{...options,credentials:'include'});
 };
})();