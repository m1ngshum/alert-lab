#!/usr/bin/env node
import Database from 'better-sqlite3';
import {open,chmod,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
const source=process.env.DB_PATH??'/data/alert-lab.db';
const target=process.argv[2];let reserved=false;
try{
  if(!target||process.argv.length!==3||resolve(source)===resolve(target))throw new Error('Usage: node bin/backup.mjs <new-backup-file>');
  const file=await open(target,'wx',0o600);await file.close();reserved=true;
  const db=new Database(source,{readonly:true,fileMustExist:true});
  try{await db.backup(target);}finally{db.close();}
  await chmod(target,0o600);console.log('Backup complete.');
}catch(error){if(reserved)await unlink(target).catch(()=>{});console.error(error.message);process.exitCode=1;}
