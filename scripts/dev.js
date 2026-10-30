// node --env-file=.env scripts/dev.js (no bundler needed)
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('public');
const routes={jasa:(await import('../api/jasa.js')).default,rpc:(await import('../api/rpc.js')).default,file:(await import('../api/file.js')).default,media:(await import('../api/media.js')).default};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const route=url.pathname.match(/^\/api\/(jasa|rpc|media|file)$/)?.[1];
  if(route){
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2400000){res.writeHead(413).end();return;}chunks.push(chunk);}
   req.body=Buffer.concat(chunks).toString();req.query=Object.fromEntries(url.searchParams);
   res.status=s=>{res.statusCode=s;return res;};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return res;};res.send=data=>{res.end(data);return res;};
   return await routes[route](req,res);
  }
  const file=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
  const bytes=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.ico':'image/x-icon'})[extname(file)]||'application/octet-stream');res.end(bytes);
 }catch(error){res.statusCode=404;res.end('Not found');}
}).listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log('JASAhub: http://localhost:'+(process.env.PORT||3000)));
