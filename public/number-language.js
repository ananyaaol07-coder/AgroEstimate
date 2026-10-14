const digits='०१२३४५६७८९';
export const englishDigits=value=>String(value).replace(/[०-९]/g,digit=>String(digits.indexOf(digit)));
export const displayDigits=(value,language)=>language==='mr'?String(value).replace(/[0-9]/g,digit=>digits[Number(digit)]):englishDigits(value);
export const parseArea=value=>Number(englishDigits(value));
