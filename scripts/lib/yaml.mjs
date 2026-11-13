import {createRequire} from "node:module";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const lock=JSON.parse(fs.readFileSync(path.join(root,"harness/lock.json")));
const YAML=createRequire(path.join(process.env.HARNESS_HOME || lock.source,"package.json"))("yaml");
export const loadYaml=t=>YAML.parse(t) ?? {};
export const loadYamlFile=p=>loadYaml(fs.readFileSync(p,"utf8"));
