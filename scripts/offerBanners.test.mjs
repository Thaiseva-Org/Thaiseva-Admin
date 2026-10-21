import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveBanner, moveBanner, safeBannerDestination} from '../src/utils/offerBanners.js';
test('saving and ordering banners preserves other changes and avoids duplicate retries', () => {
    const a = {id:'a', image:'first', active:true}, b = {id:'b', image:'second'};
    const saved = saveBanner([a,b], {...a, title:'Updated'}, true);
    assert.deepEqual(saved[1], b); assert.equal(saved[0].title, 'Updated');
    assert.deepEqual(moveBanner(saved, 'b', -1).map(item=>item.id), ['b','a']);
    assert.equal(saveBanner(saved, a, false).length, 2);
    assert.throws(()=>saveBanner([b], a, true), /removed/);
});
test('banner destinations reject executable, protocol-relative and credential-bearing URLs', () => {
    for (const value of ['javascript:alert(1)','//evil.test','/\\evil.test','https://user:pass@example.com','/a\nb']) assert.equal(safeBannerDestination(value),null);
    assert.equal(safeBannerDestination('/tours'),'/tours');
    assert.equal(safeBannerDestination('https://example.com/deal'),'https://example.com/deal');
});
