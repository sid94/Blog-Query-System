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

async function go(dataDir, options={}) {
  let blog;
  try {
    blog = await Blog.make(meta, options);
    if (options.clear) blog.clear();
    if (!options.noLoad) await loadData(dataDir, blog);
  }
  catch (err) {
      handleErrors(err);
  }
  help();
  await repl(dataDir, blog);
}

/************************ Loading Initial Data *************************/

async function loadData(dataDir, blog) {
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

/************************ Read-Eval-Print-Loop *************************/

const PROMPT = '>> ';

async function repl(dataDir, blog) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false, //no ANSI terminal escapes
    prompt: PROMPT,
  });  
  rl.on('line', async (line) => await doLine(dataDir, blog, line, rl));
  rl.prompt();
}

async function doLine(dataDir, blog, line, rl) {
  line = line.trim();
  const args = line.split(/\s+/);
  if (line.length > 0 && args.length > 0) {
    try {
      const cmd = args[0];
      const cmdInfo = COMMANDS[args[0]];
      if (!cmdInfo) {
	console.error(`invalid command "${cmd}"`);
	help(blog);
      }
      else {
	const result = await cmdInfo.handler(dataDir, blog, args.slice(1));
	if (result && (result.length > 0 || Object.keys(result).length > 0)) {
	  console.log(JSON.stringify(result, null, 2));
	}
      }
    }
    catch (err) {
      handleErrors(err);
    }
  }
  rl.prompt();
}


/*************************** Command Handling **************************/

const CATEGORIES = [ 'users', 'articles', 'comments' ];
const CATEGORIES_STR = ' ' + CATEGORIES.join('|');
const CATEGORIES_SET = new Set(CATEGORIES);

function getCategory(args) {
  let category = '';
  if (args.length == 0) {
    console.error(`must provide category ${CATEGORIES_STR}`);
    help();
  }
  else if (!CATEGORIES_SET.has(args[0])) {
    console.error(`bad category ${args[0]}`);
    help();
  }
  else {
    category = args[0];
  }
  return category;
}

/** handler for add command */
async function createHandler(dataDir, blog, args) {
  const category = getCategory(args);
  if (!category) {
    return {};
  }
  else {
    const nameValues = await getNameValues(dataDir, args.slice(1));
    return await blog.create(category, nameValues)
  }
}


/** handler for clear command */
function clearHandler(dataDir, blog, args=[]) {
  if (args.length > 0) {
    console.error('sorry; clear does not accept any arguments');
  }
  else {
    blog.clear();
  }
  return {}
}

/** handler for find command */
async function findHandler(dataDir, blog, args) {
  const category = getCategory(args);
  if (!category) {
    return {};
  }
  else {
    const nameValues = await getNameValues(dataDir, args.slice(1));
    const namesIndex = 1 + Object.keys(nameValues).length;
    const names = namesIndex < args.length ? args.slice(namesIndex) : [ 'id' ];
    const results = await blog.find(category, nameValues);
    if (names.length === 1 && names[0] === '*') {
      return results;
    }
    else {
      return results.
	map(result => Object.fromEntries(names.map(n => [n, result[n]])));
    }
  }
}

/** handler for remove command */
async function removeHandler(dataDir, blog, args) {
  const category = getCategory(args);
  if (!category) {
    return {};
  }
  else {
    const nameValues = await getNameValues(dataDir, args.slice(1));
    return await blog.remove(category, nameValues)
  }
}

/** handler for update command */
async function updateHandler(dataDir, blog, args) {
  const category = getCategory(args);
  if (!category) {
    return {};
  }
  else {
    const nameValues = await getNameValues(dataDir, args.slice(1));
    return await blog.update(category, nameValues)
  }
}

/** handler for help command */
const CMD_WIDTH = 6;
function help(_dataDir, _sensors=null, args=[]) {
  if (args.length > 0) {
    console.error('sorry; help does not accept any arguments');
  }
  Object.entries(COMMANDS).
    forEach(([k, v]) => {
      console.error(`${k.padEnd(CMD_WIDTH)}${v.msg}`);
    });
  return {}
}

/** command dispatch table and command help messages */
const COMMANDS = {
  create: {
    msg: `${CATEGORIES_STR} NAME=VALUE...`,
    handler: createHandler,
  },
  clear: {
    msg: 'clear all blog data',
    handler: clearHandler,
  },
  find: {
    msg: `${CATEGORIES_STR} NAME=VALUE... NAME...`,
    handler: findHandler,
  },
  help: {
    msg: 'output this message',
    handler: help,
  },  
  create: {
    msg: `${CATEGORIES_STR} NAME=VALUE...`,
    handler: createHandler,
  },
  remove: {
    msg: `${CATEGORIES_STR} NAME=VALUE...`,
    handler: removeHandler,
  },
  update: {
    msg: `${CATEGORIES_STR} NAME=VALUE...`,
    handler: updateHandler,
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

//gets name=value from defArgs.  Two special cases:
//value is of '[v1,v2,v3]' without spaces: splits into [v1, v2, v3]
//name is _json: merges in JSON given by path value; looks for
//file at path value and then at path dataDir/value.
async function getNameValues(dataDir, defArgs) {
  const nameValues = {};
  for (const def of defArgs) {
    const splits = def.trim().split('=');
    if (splits.length === 1) {
      break;
    }
    else if (splits.length !== 2) {
      throw `bad NAME=VALUE argument '${def}'`;
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
    }
  }
  return nameValues;
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
  '-n': 'noLoad',
  '-c': 'clear',
  '-v': 'verbose',
};

function usage() {
  const prog = Path.basename(process.argv[1]);
  const options = Object.keys(OPTIONS).join('|');
  console.error(`${prog} [${options}] DATA_DIR`);
  process.exit(1);
}


function getArgs(args) {
  const options = {};
  const arg = args.slice(-1)[0];
  if (arg.startsWith('-')) usage();
  for (const opt of args.slice(0, -1)) {
    const option = OPTIONS[opt];
    if (!option) {
      console.error(`unknown option ${opt}`);
      usage();
    }
    options[option] = true;
  }
  return [arg, options];
}

//top-level code
if (process.argv.length < 3) usage();


(async () => await go(...getArgs(process.argv.slice(2))))();

