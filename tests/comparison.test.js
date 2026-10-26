import test from 'node:test';
import assert from 'node:assert/strict';
import {compareAnswers} from '../src/comparison.js';
test('exact matches normalize CRLF without erasing meaningful indentation',()=>{
 assert.equal(compareAnswers('if x:\r\n    print(x)','if x:\n    print(x)').status,'match');
 assert.equal(compareAnswers('if x:\nprint(x)','if x:\n    print(x)').status,'different');
});
test('missing answers are distinguished from mismatches',()=>{assert.equal(compareAnswers('  \n','print(42)').status,'empty');});
test('line alignment detects insertions and preserves matching lines',()=>{
 const result=compareAnswers('a\nb\nc','a\nadded\nb\nc');
 assert.deepEqual(result.rows.map(r=>r.kind),['same','solution','same','same']);
 assert.equal(result.rows[1].text,'added');
});
test('different valid implementations are only labelled as text differences',()=>{
 assert.equal(compareAnswers('print(6 * 7)','print(42)').status,'different');
});
test('large comparisons skip the quadratic diff',()=>{
 const result=compareAnswers('a\n'.repeat(301),'b');assert.equal(result.limited,true);assert.deepEqual(result.rows,[]);
});
