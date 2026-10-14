import assert from 'node:assert/strict';
import {displayDigits,englishDigits,parseArea} from '../number-language.js';
assert.equal(displayDigits('₹6,650.00','mr'),'₹६,६५०.००');
assert.equal(displayDigits('२.५०','en'),'2.50');
assert.equal(englishDigits('१२३४५६७८९०'),'1234567890');
assert.equal(parseArea('१.२५'),1.25);
assert.equal(parseArea('1.25'),1.25);
assert.ok(Number.isNaN(parseArea('१abc')));
