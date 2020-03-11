#!/usr/bin/env nodejs
// -*- mode: JavaScript; -*-

//debugger; //uncomment to force loading into chrome debugger

import assert from 'assert';
import fs from 'fs';
import Path from 'path';
import readline from 'readline';
import util from 'util';

import meta from './meta.js';
import Blog from './blog544.js';

const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);


/************************* Top level routine ***************************/

async function go(cmd, options, args) {
  let blog;
  try {
    blog = await Blog.make(meta, options);
    const results = await doCommand(blog, cmd, options, args);
    if (results !== undefined) {
      if (results.length !== undefined) {
	console.log(JSON.stringify(results, null, 2));
      }
      else {
	console.log(results);
      }
    }
  }
  catch (err) {
    handleErrors(err);
  }
  finally {
    if (blog) await blog.close();
  }
}

/*************************** Loading Data *******************************/

async function loadHandler(blog, argsMap) {
  const { dataDir } = argsMap;
  const jsonBaseDir = Path.join(dataDir, 'json');
  await loadUsers(jsonBaseDir, blog);
  await loadArticlesComments(jsonBaseDir, blog);
}

async function loadUsers(jsonBaseDir, blog) {
  const category = 'users';
  const usersDir = Path.join(jsonBaseDir, category);
  for (const name of await readdir(usersDir)) {
    if (name.endsWith('.json')) {
      const user = await readJson(usersDir, name);
      await blog.create(category, user);
    }
  }
}

async function loadArticlesComments(jsonBaseDir, blog) {
  const articlesDir = Path.join(jsonBaseDir, 'articles');
  const commentsDir = Path.join(jsonBaseDir, 'comments');
  for (const name of await readdir(articlesDir)) {
    if (name.endsWith('.json')) {
      const article = await readJson(articlesDir, name);
      const articleId = await blog.create('articles', article);
      await loadComments(commentsDir, name, articleId, blog);
    }
  } 
}

async function loadComments(commentsDir, fileName, articleId, blog) {
  const commentObjs = await readJson(commentsDir, fileName);
  for (const comment of commentObjs) {
    await blog.create('comments', Object.assign({}, {articleId}, comment));
  }
}

/************************** Arguments Handling *************************/


const CATEGORIES = [ 'users', 'articles', 'comments' ];
const CATEGORIES_STR = ' ' + CATEGORIES.join('|');
const CATEGORIES_SET = new Set(CATEGORIES);

function categoryArg(args, argsMap) {
  let category = '';
  if (args.length == 0) {
    usage(`must provide category ${CATEGORIES_STR}`);
  }
  else if (!CATEGORIES_SET.has(args[0])) {
    usage(`bad category ${args[0]}`);
  }
  else {
    argsMap.category = args[0];
  }
  return args.slice(1);
}

//dataDir identified by having a / in it
function optDataDirArg(args, argsMap) {
  return (args.length > 0 && args[0].indexOf('/') >= 0)
    ? dataDirArg(args, argsMap)
    : args;
}

function dataDirArg(args, argsMap) {
  if (args.length === 0) {
    usage(`DATA_DIR must be specified`);
  }
  argsMap.dataDir = args[0];
  return args.slice(1);
}

function namesArgs(args, argsMap) {
  if (args.length > 0 && args[0] !== '*') {
    const category = argsMap.category;
    const catMeta = meta[category];
    args.forEach(name => {
      if (catMeta.findIndex(f => f.name === name) < 0) {
	usage(`unknown name "${name}" for category ${category}`);
      }
    });
  }
  argsMap.names =  (args.length > 0) ? args : [ 'id' ];
  return [];
}

//gets name=value from args.  Two special cases:
//value is of '[v1,v2,v3]' without spaces: splits into [v1, v2, v3]
//name is _json: merges in JSON given by path value; looks for
//file at path value and then at path dataDir/value.
async function nameValuesArgs(args, argsMap) {
  const dataDir = argsMap.dataDir || '.';
  const nameValues = {};
  let n = 0;
  for (const def of args) {
    const splits = def.trim().split('=');
    if (splits.length === 1) {
      break;
    }
    else if (splits.length !== 2) {
      usage(`bad NAME=VALUE argument '${def}'`);
    }
    let [name, value] = splits;
    if (name === '_json') {
      Object.assign(nameValues, await findAndReadJson(dataDir, value))
    }
    else {
      if (value.startsWith('[') && value.endsWith(']')) {
	value = value.slice(1, -1).split(',');
      }
      nameValues[name] = value;
      n += 1;
    }
  }
  argsMap.nameValues = nameValues;
  return args.slice(n);
}

async function findAndReadJson(dataDir, value) {
  let path;
  if (fs.existsSync(value)) {
    path = value;
  }
  else {    
    path = Path.join(dataDir, value);
    if (!fs.existsSync(path)) {
      console.error(`cannot find json file at ${value}`);
      return {};
    }
  }
  return await readJson('', path);
}

/*************************** Command Handling **************************/

async function doCommand(blog, command, options, args) {
  const commandInfo = COMMANDS[command];
  assert(commandInfo);
  const argsMap = {};
  for (const argsFn of commandInfo.args) {
    args = await argsFn(args, argsMap);
  }
  if (args.length != 0) {
    usage(`unknown arguments ${args}`);
  }
  return await commandInfo.handler(blog, argsMap, options);
}

/** handler for create command */
async function createHandler(blog, argsMap) {
  const { category, nameValues} = argsMap;
  return await blog.create(category, nameValues)
}


/** handler for clear command */
async function clearHandler(blog, argsMap) {
  await blog.clear();
  return {}
}

/** handler for find command */
async function findHandler(blog, argsMap) {
  const {category, nameValues, names} = argsMap;
  const results = await blog.find(category, nameValues);
  if (names.length === 1 && names[0] === '*') {
    return results;
  }
  else {
    return results.
      map(result => Object.fromEntries(names.map(n => [n, result[n]])));
  }
}

/** handler for remove command */
async function removeHandler(blog, argsMap) {
  const { category, nameValues} = argsMap;
  return await blog.remove(category, nameValues)
}

/** handler for update command */
async function updateHandler(blog, argsMap) {
  const { category, nameValues} = argsMap;
  return await blog.update(category, nameValues)
}

function helpHandler() { usage(); }

/** command dispatch table and command help messages */
const COMMANDS = {
  create: {
    argsDescr: `${CATEGORIES_STR} [DATA_DIR] NAME=VALUE...`,
    args: [ categoryArg, optDataDirArg, nameValuesArgs, ],
    handler: createHandler,
  },
  clear: {
    argsDescr: '',
    args: [],
    handler: clearHandler,
  },
  find: {
    argsDescr: `${CATEGORIES_STR} [DATA_DIR] NAME=VALUE... NAME...`,
    args: [ categoryArg, optDataDirArg, nameValuesArgs, namesArgs ],
    handler: findHandler,
  },
  help: {
    argsDescr: '',
    args: [],
    handler: helpHandler,
  },  
  remove: {
    argsDescr: `${CATEGORIES_STR} NAME=VALUE...`,
    args: [ categoryArg, nameValuesArgs ],
    handler: removeHandler,
  },
  update: {
    argsDescr: `${CATEGORIES_STR} NAME=VALUE...`,
    args: [ categoryArg, nameValuesArgs, ],
    handler: updateHandler,
  },
  load: {
    argsDescr: `DATA_DIR`,
    args: [ dataDirArg, ],
    handler: loadHandler,
  },
};


/****************************** Helpers ********************************/

async function readJson(dataDir, dataFile) {
  try {
    const text = await readFile(Path.join(dataDir, dataFile), 'utf8');
    return JSON.parse(text);
  }
  catch (err) {
    throw [ `cannot read ${dataFile} in ${dataDir}: ${err}` ];
  }
}


function handleErrors(err) {
  if (typeof err === 'object' && err instanceof Array) {
    for (const e of err) { console.error(e.toString()); }
  }
  else {
    console.error(err);
  }
}

/************************** Command-Line Handling **********************/

const OPTIONS = {
};

/** handler for help command */
const CMD_WIDTH = 6;
function usage(msg) {
  if (msg) console.error('*** ', msg);
  const prog = Path.basename(process.argv[1]);
  const options = Object.keys(OPTIONS).join('|');
  console.error(`usage: ${prog} MONGO_DB_URL COMMAND`);
  console.error(`  where COMMAND is one of `);
  Object.keys(COMMANDS).sort().
    forEach(k => {
      const v = COMMANDS[k];
      console.error(`  ${k.padEnd(CMD_WIDTH)}${v.argsDescr}`);
    });
  process.exit(1);
}


function getArgs(args) {
  const options = {};
  let i;
  for (i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('-')) {
      break;
    }
    else {
      const opt = arg;
      const option = OPTIONS[opt];
      if (!option) {
	usage(`unknown option ${opt}`);
      }
      options[option] = true;
    }
  } //for
  if (args.length - i < 2) { //minimally mongoUrl COMMAND
    usage();
  }
  const [ mongoUrl, cmd, ...rest ] = args.slice(i);
  if (!mongoUrl.startsWith('mongodb://')) {
    usage(`bad mongo url ${mongoUrl}`);
  }
  options.dbUrl = mongoUrl;
  if (COMMANDS[cmd] === undefined) {
    usage(`bad command ${cmd}`);
  }
  return [cmd, options, args.slice(i + 2)];
}

//top-level code
if (process.argv.length < 4) usage();


(async () => await go(...getArgs(process.argv.slice(2))))();

