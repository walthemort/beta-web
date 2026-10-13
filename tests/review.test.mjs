import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractGuide,checkedURL,publicAddress} from '../review.mjs';
test('extracts brand styles from stylesheets without treating scripts and comments as colours',()=>{
 const html='<title>Example studio</title><script>const fake="#123456"</script><!-- #654321 --><style>body{color:#fff;font-family:"Studio Sans",sans-serif;font-size:16px}</style><img src="/logo.svg" alt="Our logo">';
 const result=extractGuide(html,['h1{color:#1b4dff;font-size:3rem} p{color:#FFFFFF;font-family:"Editorial",serif} /* #ff0000 */']);
 assert.deepEqual(result.colors,['#FFFFFF','#1B4DFF']);assert.deepEqual(result.fonts,['Studio Sans','Editorial']);assert.deepEqual(result.sizes,['16px','3rem']);assert.equal(result.logoSvg,true);assert.equal(result.title,'Example studio');
});
test('keeps absent findings distinct from confirmed assets',()=>{const r=extractGuide('<title>Plain site</title>');assert.deepEqual(r.colors,[]);assert.deepEqual(r.fonts,[]);assert.equal(r.svg,false);assert.equal(r.logoSvg,false)});
test('rejects dangerous URLs and private addresses',()=>{
 for(const value of ['file:///etc/passwd','https://user:password@example.com','https://example.com:3000','http://127.0.0.1','http://2130706433','http://[::1]','http://localhost',''])assert.throws(()=>checkedURL(value));
 for(const value of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1'])assert.equal(publicAddress(value),false);
 assert.equal(publicAddress('93.184.216.34'),true);assert.equal(checkedURL('example.com').href,'https://example.com/');
});
