import {cp,mkdir,rm} from "node:fs/promises";
const root=new URL("../",import.meta.url), output=new URL("../dist/",import.meta.url);
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
await cp(new URL("index.html",root),new URL("index.html",output));
await cp(new URL("src/",root),new URL("src/",output),{recursive:true});
await cp(new URL("public/",root),output,{recursive:true});
console.log("KitchAI app shell built to dist/");
