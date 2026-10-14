export const languageKey='agro:language';
export function preferredLanguage(location,storage) {
 const selected=new URLSearchParams(location.search).get('lang');
 if(selected==='mr'||selected==='en')return selected;
 try {if(storage?.getItem(languageKey)==='mr')return 'mr';}catch{}
 return 'en';
}
export function languageUrl(path,base,language) {
 const url=new URL(path,base);
 if(url.origin!==new URL(base).origin || !/\.html$/.test(url.pathname))return path;
 url.searchParams.set('lang',language==='mr'?'mr':'en');
 return url.href;
}
