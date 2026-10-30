import {ApiError} from './supabase.js';
export function noStore(res){res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');}
export function errorResponse(res,error){
 console.error('JASAhub API:',error.publicMessage?'validation':(error.upstreamCode||error.name||'upstream'));
 return res.status(error.status||(error.publicMessage?400:503)).json({ok:false,error:error.publicMessage||'Server belum dapat mengakses Supabase. Periksa konfigurasi atau coba lagi.',code:error.code||'SERVER_UNAVAILABLE'});
}
export function validatePost(req){
 if(req.method!=='POST')throw new ApiError('Gunakan POST.',405);
 const origin=req.headers.origin,host=req.headers.host;
 if(origin&&origin!==`https://${host}`&&!(origin===`http://${host}`&&/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host||'')))throw new ApiError('Origin tidak diizinkan.',403);
 if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new ApiError('Gunakan JSON.',415);
 let p;try{p=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{throw new ApiError('Format JSON tidak valid.');}
 if(!p||Array.isArray(p)||typeof p!=='object'||JSON.stringify(p).length>2400000)throw new ApiError('Permintaan tidak valid atau terlalu besar.');
 return p;
}
