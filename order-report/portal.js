(function(){
const form=document.getElementById('requisition-form'),msg=document.getElementById('form-message'),btn=document.getElementById('submit-button');
const formPanel=document.getElementById('form-panel'),success=document.getElementById('success-panel'),ref=document.getElementById('reference-number');
const login=document.getElementById('login-form'),loginMsg=document.getElementById('login-message');
const phoneValid=v=>{const d=(v||'').replace(/\D/g,'');return d.length>=10&&d.length<=13};
const say=(el,text,kind)=>{el.className='form-message'+(kind?' '+kind:'');el.textContent=text};

// Spam protection (Cloudflare Turnstile). Switches on automatically once a site key is placed in the page's <meta name="sv-assure-turnstile-sitekey">.
let tsToken='',tsWidget=null;
const siteKey=(document.querySelector('meta[name="sv-assure-turnstile-sitekey"]')||{}).content;
if(siteKey){
  const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;
  s.onload=()=>{tsWidget=window.turnstile.render('#turnstile-box',{sitekey:siteKey,callback:t=>{tsToken=t},'expired-callback':()=>{tsToken=''}})};
  document.head.appendChild(s);
}

form.addEventListener('submit',async e=>{
  e.preventDefault();say(msg,'');
  if(form.elements.website.value)return;
  const d=Object.fromEntries(new FormData(form).entries());
  d.modules=Array.from(form.querySelectorAll('input[name="modules"]:checked')).map(i=>i.value);
  const need=[['borrowerName','the borrower / company name'],['borrowerMobile','the borrower mobile number'],['bankerName','your name'],['designation','your designation'],['bankName','your bank / institution'],['bankerMobile','your contact number'],['bankerEmail','your official email']];
  for(const [k,label] of need){if(!String(d[k]||'').trim()){say(msg,'Please enter '+label+'.','error');form.elements[k].focus();return}}
  if(!phoneValid(d.borrowerMobile)){say(msg,'Please enter a valid borrower mobile number.','error');form.elements.borrowerMobile.focus();return}
  if(!phoneValid(d.bankerMobile)){say(msg,'Please enter a valid contact number for yourself.','error');form.elements.bankerMobile.focus();return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.bankerEmail)){say(msg,'Please enter a valid official email address.','error');form.elements.bankerEmail.focus();return}
  if(!d.consent){say(msg,'Please tick the borrower-consent confirmation at the end of the form to submit.','error');return}
  if(siteKey&&!tsToken){say(msg,'Please complete the spam check above, then submit again.','error');return}
  d.turnstileToken=tsToken;
  btn.disabled=true;btn.textContent='Submitting…';
  try{
    const res=await window.svaApi('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||'We could not submit the requisition. Please try again or contact us on WhatsApp.');
    ref.textContent=data.reference;formPanel.hidden=true;success.hidden=false;
    success.scrollIntoView({behavior:'smooth',block:'center'});
  }catch(err){
    say(msg,err.message||'Submission failed. Please try again.','error');
    if(tsWidget!==null&&window.turnstile){window.turnstile.reset(tsWidget);tsToken=''}
  }finally{btn.disabled=false;btn.textContent='Submit requisition'}
});

login.addEventListener('submit',async e=>{
  e.preventDefault();say(loginMsg,'Sending your secure sign-in link…');
  const email=login.elements.email.value.trim();
  try{
    const r=await window.svaApi('/api/auth/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
    const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to send link');
    say(loginMsg,d.message||'Check your inbox for a sign-in link.','ok');
  }catch(err){say(loginMsg,err.message||'Unable to send link.','error')}
});

document.getElementById('new-order').addEventListener('click',()=>{form.reset();formPanel.hidden=false;success.hidden=true;say(msg,'')});
})();
