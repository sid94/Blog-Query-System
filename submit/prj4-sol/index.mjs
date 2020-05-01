//-*- mode: javascript -*-

import assert from 'assert';
import Path from 'path';
import process from 'process';

import Blog544Ws from './blog544-ws.mjs';
import serve from './blog544-ss.mjs';

function usage() {
  console.error(`usage: ${Path.basename(process.argv[1])} PORT WS_URL`);
  process.exit(1);
}

function getPort(portArg) {
  let port = Number(portArg);
  if (!port) usage();
  return port;
}

async function go(args) {
  try {
    const port = getPort(args[0]);
    const wsUrl = args[1];
    const blogWs = await Blog544Ws.make(wsUrl);
    serve(port, blogWs);
  }
  catch (err) {
    console.error(err);
  }
}
    

if (process.argv.length != 4) usage();
go(process.argv.slice(2));
