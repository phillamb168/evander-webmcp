import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { registerTools } from '@evander-webmcp/browser';
import { createRouteMap } from '@evander-webmcp/contracts';
const win=new Window({url:'https://frontend.example/about'});
for(const key of ['document','HTMLElement','customElements','sessionStorage','location']) globalThis[key]=win[key];
globalThis.window=win; globalThis.addEventListener=win.addEventListener.bind(win); globalThis.removeEventListener=win.removeEventListener.bind(win);
const {defineAssistant}=await import('@evander-webmcp/widget'); defineAssistant();
const map=createRouteMap({sourceOrigin:'https://content.example',publicOrigin:location.origin,routes:[{path:'/about',sourcePath:'/node/1',preserveAnchors:true}]});
function context() {
  const tools=new Map(); return {tools,registerTool(tool,{signal}) {assert.equal(tools.has(tool.name),false); tools.set(tool.name,tool); signal.addEventListener('abort',()=>tools.delete(tool.name),{once:true});}};
}
function fetchTools(requests=[]) {
  globalThis.fetch=async (url,options)=>{
    if(options.method) {requests.push(JSON.parse(options.body)); return Response.json({version:'1.0',result:{status:'ok',page:{title:'About',url:'https://content.example/node/1',path:'/node/1'},chunks:[{id:'history',heading:'History',text:'Opened in 2010.',anchor:'#history'}]}});}
    return Response.json({version:'1.0',tools:[{name:'evander_get_current_page',inputSchema:{type:'object'}}]});
  };
}
test('Headless native tools map current page and verified navigation, reject invented destinations',async()=>{
  document.body.innerHTML='<section id="history" data-evander-section>History</section>';
  const ctx=context(),requests=[],navigated=[]; fetchTools(requests);
  const controller=await registerTools({...map,manifestUrl:'/tools',callUrl:'/call',navigate:url=>navigated.push(url)},ctx);
  await ctx.tools.get('evander_get_current_page').execute({path:'/forged'}); assert.equal(requests[0].arguments.path,'/node/1');
  await ctx.tools.get('evander_navigate').execute({url:'https://content.example/node/1#history'}); assert.equal(document.activeElement.id,'history');
  await ctx.tools.get('evander_navigate').execute({url:'https://content.example/node/1'}); assert.deepEqual(navigated,['https://frontend.example/about']);
  await assert.rejects(ctx.tools.get('evander_navigate').execute({url:'https://content.example/node/2'}),/Unverified/);
  controller.refresh(); await assert.rejects(ctx.tools.get('evander_navigate').execute({url:'https://content.example/node/1'}),/Unverified/);
  controller.abort(); assert.equal(ctx.tools.size,0);
});
test('Unmapped current page does not fetch a guessed path',async()=>{
  fetchTools(); const ctx=context(); const controller=await registerTools({manifestUrl:'/tools',callUrl:'/call',resolveCurrentPath:()=>null},ctx);
  const result=await ctx.tools.get('evander_get_current_page').execute({path:'/invented'}); assert.equal(result.status,'unavailable'); controller.abort();
});
test('Registration supports cancellation, cleanup, remount and rejects duplicate mounts',async()=>{
  fetchTools(); const ctx=context(),abort=new AbortController();
  const controller=await registerTools({manifestUrl:'/tools',signal:abort.signal},ctx);
  await assert.rejects(registerTools({manifestUrl:'/tools'},ctx),/already registered/);
  abort.abort(); assert.equal(controller.signal.aborted,true); assert.equal(ctx.tools.size,0);
  const next=await registerTools({manifestUrl:'/tools'},ctx); next.abort(); assert.equal(ctx.tools.size,0);
  const cancelled=new AbortController(); cancelled.abort(); await assert.rejects(registerTools({manifestUrl:'/tools',signal:cancelled.signal},ctx),{name:'AbortError'});
});
test('Route changes during native execution cannot add stale navigation evidence',async()=>{
  fetchTools(); const ctx=context(),controller=await registerTools({manifestUrl:'/tools',callUrl:'/call'},ctx);
  let finish; globalThis.fetch=()=>new Promise(resolve=>finish=resolve);
  const pending=ctx.tools.get('evander_get_current_page').execute({}); win.history.pushState({},'','/changed');
  finish(Response.json({result:{status:'ok',links:[{label:'Old',url:'https://frontend.example/old'}]}}));
  await assert.rejects(pending,/Page changed/); controller.abort(); win.history.replaceState({},'','/about');
});
test('Widget maps verified sources to frontend links and delegates SPA navigation',async()=>{
  const navigated=[],widget=document.createElement('evander-assistant'); widget.setAttribute('endpoint','https://backend.example'); widget.setAttribute('site-id','portable'); widget.integration={...map,navigate:url=>navigated.push(url)}; document.body.append(widget);
  globalThis.fetch=async()=>Response.json({answer:'Verified',session:'synthetic',links:[{label:'About',url:'https://content.example/node/1'},{label:'External',url:'https://content.example/unmapped'}]});
  await widget.ask('About'); const links=widget.links.querySelectorAll('a'); assert.equal(links[0].href,'https://frontend.example/about'); assert.equal(links[1].href,'https://content.example/unmapped');
  links[0].click(); assert.deepEqual(navigated,['https://frontend.example/about']); widget.remove();
});
test('Refreshing a route invalidates pending tool evidence even after navigating back',async()=>{
  fetchTools(); const ctx=context(),controller=await registerTools({manifestUrl:'/tools',callUrl:'/call'},ctx);
  let finish; globalThis.fetch=()=>new Promise(resolve=>finish=resolve);
  const pending=ctx.tools.get('evander_get_current_page').execute({}); controller.refresh();
  finish(Response.json({result:{status:'ok',links:[{label:'Old',url:'https://frontend.example/old'}]}}));
  await assert.rejects(pending,/Page changed/); controller.abort();
});
test('A route change or unmount ignores late widget responses even if transport ignores abort',async()=>{
  const widget=document.createElement('evander-assistant'); widget.setAttribute('endpoint','https://backend.example'); widget.setAttribute('site-id','route-race'); document.body.append(widget);
  let finish; globalThis.fetch=()=>new Promise(resolve=>finish=resolve);
  const pending=widget.ask('Old route'); widget.refreshContext();
  finish(Response.json({answer:'Stale answer',session:'old',links:[]})); await pending;
  assert.equal(widget.response.textContent,'Request cancelled.'); assert.equal(widget.querySelector('[type=submit]').disabled,false);
  assert.notEqual(widget.token,'old'); widget.remove();
});
