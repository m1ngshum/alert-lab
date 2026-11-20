import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {presets,evaluate} from '../web/policy.js';
import {parseSuite,replay,markdown,maxBytes} from '../web/replay.js';

class Element extends EventTarget {
  children=[];
  dataset={};
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=items;}
  setAttribute(){}
  click(){this.dispatchEvent(new Event('click'));}
}

function playground(){
  const elements=new Map(), downloads=[];
  const element=id=>{
    if(!elements.has(id))elements.set(id,new Element());
    return elements.get(id);
  };
  const rechecks=['cleared','persistent','worse'].map(action=>Object.assign(new Element(),{dataset:{recheck:action}}));
  const document=Object.assign(new EventTarget(),{
    getElementById:element,
    querySelectorAll:()=>rechecks,
    createElement:tag=>tag==='a'?{click(){assert.equal(this.download,'alert-lab-evidence.json');}}:new Element()
  });
  const context={document,presets,evaluate,parseSuite,replay,markdown,maxBytes,Event,CustomEvent,Blob,
    URL:{createObjectURL(blob){downloads.push(blob);return 'blob:test';}},setTimeout(){}};
  for(const script of ['app.js','replay-ui.js']){
    runInNewContext(readFileSync(new URL('../web/'+script,import.meta.url),'utf8').replace(/^import .*\n/,''),context);
  }
  return {
    click:id=>element(id).click(),
    recheck:action=>rechecks.find(button=>button.dataset.recheck===action).click(),
    scenario:()=>element('scenarios').children[0].click(),
    async verify(kind,count){
      assert.equal(element('result').children[0].className,'decision '+kind);
      assert.match(element('audit').children[0].children[1].textContent,new RegExp('rechecks: '+count+'$'));
      element('replay-export').click();
      const suite=parseSuite(await downloads.at(-1).text());
      assert.equal(suite.cases[0].steps[0].evidence.rechecks,count);
    }
  };
}

test('clearing on the first or second recheck preserves the recorded and exported count',async()=>{
  const ui=playground();
  ui.click('run');
  ui.recheck('cleared');
  await ui.verify('resolved',1);
  ui.click('reset');
  ui.click('run');
  await ui.verify('observe',0);
  ui.recheck('persistent');
  await ui.verify('observe',1);
  ui.recheck('cleared');
  await ui.verify('resolved',2);
  ui.scenario();
  ui.click('run');
  await ui.verify('observe',0);
  ui.recheck('persistent');
  ui.recheck('persistent');
  await ui.verify('review',2);
});
