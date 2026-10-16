import test from 'node:test';
import assert from 'node:assert/strict';
import { getAlbumCover, albumCoverUpdate } from './album-cover.js';
const photos = [{id:'a',eventId:'album',type:'image/jpeg',url:'/a'}, {id:'b',eventId:'album',type:'image/png',url:'/b'}, {id:'video',eventId:'album',type:'video/mp4',url:'/v'}, {id:'other',eventId:'other',type:'image/jpeg',url:'/other'}];
test('cover selection only accepts an existing image from the selected album',()=>{
 assert.deepEqual(albumCoverUpdate('album','b',photos),{coverMediaId:'b',coverUrl:'/b'});
 for(const id of ['video','other','missing']) assert.throws(()=>albumCoverUpdate('album',id,photos));
 assert.deepEqual(albumCoverUpdate('album',null,photos),{coverMediaId:null,coverUrl:null});
});
test('chosen cover survives reordering and falls back when its photo is removed',()=>{
 const event={id:'album',coverMediaId:'b',coverUrl:'/b'};
 assert.equal(getAlbumCover(event,photos).id,'b');
 assert.equal(getAlbumCover(event,[...photos].reverse()).id,'b');
 assert.equal(getAlbumCover(event,photos.filter(p=>p.id!=='b')).id,'a');
 assert.equal(getAlbumCover(event,photos.filter(p=>p.type.startsWith('video'))),null);
 assert.equal(getAlbumCover({id:'album',coverUrl:'/b'},photos).id,'b');
});
