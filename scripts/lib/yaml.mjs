import {createRequire} from "node:module";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
function resolveYaml(){
  const bases=[process.env.HARNESS_HOME];
  try{const lock=JSON.parse(fs.readFileSync(path.join(root,"harness/lock.json"),"utf8"));if(lock.source)bases.push(lock.source);}catch{}
  bases.push(root);
  for(const base of bases){
    if(!base)continue;
    try{return createRequire(path.join(base,"package.json"))("yaml");}catch{}
  }
  throw new Error("yaml nicht gefunden: npm ci im Projekt-Root ausfuehren oder HARNESS_HOME setzen.");
}
const YAML=resolveYaml();
export const loadYaml=t=>YAML.parse(t) ?? {};
export const loadYamlFile=p=>loadYaml(fs.readFileSync(p,"utf8"));
