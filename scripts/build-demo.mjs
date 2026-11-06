import {cpSync,mkdirSync,rmSync} from 'node:fs';
const output=new URL('../dist/',import.meta.url);
rmSync(output,{recursive:true,force:true});
mkdirSync(output);
cpSync(new URL('../web/',import.meta.url),output,{recursive:true});
console.log('Static playground copied to dist/.');
