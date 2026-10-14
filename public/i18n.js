import {displayDigits,englishDigits} from './number-language.js';
import {translate} from './translations.js?v=email-verification-1';
import {languageKey,preferredLanguage,languageUrl} from './language-preference.js?v=mr-3';
const storageKey=languageKey;
let storage;try{storage=window.localStorage;}catch{}
let language=preferredLanguage(location,storage);
const pageUrl=path=>languageUrl(path,location.href,language);
const originals=new WeakMap();
const attributes=new WeakMap();
const excluded='script,style,textarea,[translate="no"],.profile-name,.avatar-dot,.user-row';
function renderText(node) {
 if(node.parentElement?.closest(excluded))return;
 const previous=originals.get(node);
 const source=previous && node.data===previous.rendered?previous.source:node.data;
 if(node.parentElement?.tagName==='OPTION' && !node.parentElement.hasAttribute('value'))node.parentElement.value=source.trim();
 const numeric=node.parentElement?.closest('[id$="-result"],.area-unit-help,#admin-analytics,.history-panel,.history-entry');
 const rendered=numeric?displayDigits(translate(source,language),language):translate(source,language);
 originals.set(node,{source,rendered});
 if(node.data!==rendered)node.data=rendered;
}
function render() {
 observer.disconnect();
 document.documentElement.lang=language;
 const walker=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT);
 while(walker.nextNode())renderText(walker.currentNode);
 for(const element of document.querySelectorAll('[placeholder],[aria-label],[title]')) {
  if(element.closest(excluded))continue;
  const saved=attributes.get(element)||{};
  for(const name of ['placeholder','aria-label','title']) {
   if(!element.hasAttribute(name))continue;
   const current=element.getAttribute(name),old=saved[name];
   const source=old&&current===old.rendered?old.source:current;
   const rendered=translate(source,language);saved[name]={source,rendered};
   if(current!==rendered)element.setAttribute(name,rendered);
  }
  attributes.set(element,saved);
 }
 for(const link of document.querySelectorAll('a[href]')) {
  if(link.hasAttribute('download') || link.getAttribute('href').startsWith('#'))continue;
  const href=pageUrl(link.getAttribute('href'));
  if(link.href!==href)link.href=href;
 }
 document.querySelectorAll('input[id$="-area"]').forEach(field=>{
  const value=displayDigits(field.value,language);
  field.type=language==='mr'?'text':'number';field.inputMode='decimal';
  field.value=value;
  validateArea(field);
 });
 document.querySelectorAll('[data-language-select]').forEach(select=>select.value=language);
 document.querySelectorAll('.language-current').forEach(text=>{const value=language==='mr'?'म':'EN';if(text.textContent!==value)text.textContent=value;});
 observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
}
function validateArea(field) {
 if(language!=='mr'){field.setCustomValidity('');return;}
 const value=englishDigits(field.value).trim();
 const valid=value==='' || (/^\d*(?:\.\d{1,2})?$/.test(value) && Number(value)>=0.01);
 field.setCustomValidity(valid?'':'कृपया ०.०१ किंवा त्यापेक्षा मोठे क्षेत्रफळ टाका (जास्तीत जास्त दोन दशांश अंक).');
}
const observer=new MutationObserver(render);
function setLanguage(value) {
 language=value==='mr'?'mr':'en';
 try{storage?.setItem(storageKey,language);}catch{}
 try{history.replaceState(history.state,'',pageUrl(location.href));}catch{}
 render();window.dispatchEvent(new CustomEvent('agro-language-change',{detail:language}));
}
window.agroI18n={t:text=>translate(text,language),get language(){return language;},url:pageUrl,setLanguage};
const label=document.createElement('label');label.className='language-picker';label.setAttribute('translate','no');
label.innerHTML='<span class="language-label">Language / भाषा</span><select data-language-select aria-label="Language / भाषा"><option value="en" lang="en">English</option><option value="mr" lang="mr">मराठी</option></select><span class="language-current" aria-hidden="true">EN</span><span class="language-chevron" aria-hidden="true">⌄</span>';
const nav=document.querySelector('header nav');
const account=document.querySelector('.landing-nav .account-links');
if(account)account.prepend(label);
else if(nav) {
 const back=nav.querySelector(':scope > a.nav-link');
 if(back) {
  const actions=document.createElement('div');actions.className='header-actions';
  back.before(actions);actions.append(back,label);
 } else nav.append(label);
}
label.querySelector('select').addEventListener('change',event=>setLanguage(event.target.value));
window.addEventListener('storage',event=>{if(event.key===storageKey)setLanguage(event.newValue);});
// Native browser messages follow the browser language; localize required-field feedback.
document.addEventListener('invalid',event=>{
 const field=event.target;
 if(language==='mr' && !field.validity.customError)field.setCustomValidity(translate(field.validity.valueMissing?'Please fill out this field.':field.validity.typeMismatch&&field.type==='email'?'Please enter a valid email address.':'Please enter a valid value.'));
},true);
document.addEventListener('input',event=>{if(event.target.setCustomValidity && event.target.name!=='newPassword')event.target.setCustomValidity('');},true);
window.addEventListener('agro-language-change',()=>document.querySelectorAll('input,select,textarea').forEach(field=>{if(field.name!=='newPassword')field.setCustomValidity('');}));
window.addEventListener('agro-language-change',()=>document.querySelectorAll('input[id$="-area"]').forEach(validateArea));
document.addEventListener('input',event=>{if(event.target.matches('input[id$="-area"]'))validateArea(event.target);});
window.addEventListener('pageshow',()=>{language=preferredLanguage(location,storage);render();});
setLanguage(language);
