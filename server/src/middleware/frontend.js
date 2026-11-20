import express from 'express';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';

export function serveFrontend(app, directory) {
  const index = join(directory,'index.html');
  if (!existsSync(index)) throw new Error('Production frontend build missing. Build client before starting the API.');
  const apiPath = path => /^\/api(?:\/|$)/i.test(path);
  const assets = express.static(directory, { index:false,dotfiles:'deny',setHeaders(res,file) {
    res.setHeader('Cache-Control',file.startsWith(join(directory,'assets')+'/') || file.startsWith(join(directory,'assets')+'\\')
      ? 'public, max-age=31536000, immutable' : 'no-cache');
  } });
  app.use((req,res,next) => {
    let decoded;
    try { decoded=decodeURIComponent(req.path); } catch { return res.status(400).end(); }
    if (decoded.split(/[\\/]/).some(part=>part.startsWith('.'))) return res.status(404).end();
    return apiPath(decoded) ? next() : assets(req,res,next);
  });
  app.get(/.*/, (req,res,next) => {
    if (apiPath(req.path) || extname(req.path) || !req.accepts('html')) return next();
    res.set('Cache-Control','no-store');
    res.sendFile(index);
  });
}
