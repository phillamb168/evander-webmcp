import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { Window } from 'happy-dom';
import { EvanderAssistant, useWebMCP } from '@evander-webmcp/react';
const win=new Window({url:'https://react.example/'});
for(const key of ['document','HTMLElement','customElements','sessionStorage','location']) globalThis[key]=win[key];
globalThis.window=win; globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.addEventListener=win.addEventListener.bind(win); globalThis.removeEventListener=win.removeEventListener.bind(win);
const { createRoot }=await import('react-dom/client');
test('React StrictMode mount, route refresh, unmount and remount leave no duplicate native tools',async()=>{
  const tools=new Map(); let registrations=0;
  document.modelContext={registerTool(tool,{signal}) { assert.equal(tools.has(tool.name),false); tools.set(tool.name,tool); registrations++; signal.addEventListener('abort',()=>tools.delete(tool.name),{once:true}); }};
  globalThis.fetch=async(url,options)=>Response.json(options?.method?{result:{status:'ok'}}:{tools:[{name:'evander_get_current_page',inputSchema:{type:'object'}}]});
  const options={manifestUrl:'/tools',callUrl:'/call',onError:error=>{throw error;}};
  function App({path}) {useWebMCP(options,path); return React.createElement(EvanderAssistant,{endpoint:'https://backend.example',siteId:'react-test',routeKey:path,integration:options});}
  const host=document.createElement('div');document.body.append(host);let root=createRoot(host);
  await act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(App,{path:'/'}))));
  assert.equal(tools.size,2); const initial=registrations;
  win.history.pushState({},'','/next');
  await act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(App,{path:'/next'}))));
  assert.equal(registrations,initial); assert.equal(tools.size,2);
  await act(async()=>root.unmount()); assert.equal(tools.size,0);
  root=createRoot(host); await act(async()=>root.render(React.createElement(App,{path:'/next'}))); assert.equal(tools.size,2);
  await act(async()=>root.unmount()); assert.equal(tools.size,0); host.remove();
});
