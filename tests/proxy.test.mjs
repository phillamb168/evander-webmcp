import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { fixedToolProxy } from '../examples/shared/http.mjs';
test('Example proxy has fixed endpoints, bounded bodies and no forwarded credentials',async()=>{
  const calls=[];
  const proxy=fixedToolProxy({origin:'http://frontend.example',toolBase:'https://source.example',fetchImpl:async(url,options)=>{calls.push({url,options}); return Response.json(options.method==='GET'?{version:'1.0',tools:[{name:'read',inputSchema:{type:'object'}}]}:{version:'1.0',result:{status:'ok'}});}});
  const server=http.createServer((req,res)=>proxy(req,res,()=>{res.writeHead(404);res.end();})); server.listen(0,'127.0.0.1'); await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}/evander-webmcp/v1/call`;
  const post=body=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Cookie:'private=sentinel',Authorization:'Bearer sentinel'},body:JSON.stringify(body)});
  try {
    assert.equal((await post({name:'read',arguments:{}})).status,200);
    assert.equal(calls.length,2); assert.equal(calls[1].url,'https://source.example/evander-webmcp/v1/call');
    assert.equal(calls[1].options.headers.Cookie,undefined); assert.equal(calls[1].options.headers.Authorization,undefined); assert.equal(calls[1].options.redirect,'error');
    assert.equal((await post({name:'read',arguments:{},url:'https://attacker.example'})).status,400);
    assert.equal((await post({name:'unknown',arguments:{}})).status,400);
    assert.equal((await post({name:'read',arguments:{text:'x'.repeat(17000)}})).status,413);
    assert.equal((await fetch(url,{method:'POST',headers:{Origin:'https://attacker.example'}})).status,403);
    assert.equal((await fetch(url+'?url=https://attacker.example')).status,404);
  } finally {server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));}
});
