#!/usr/bin/env nodejs

import assert from 'assert';
import fs from 'fs';
import Path from 'path';
import process from 'process';
import util from 'util';

const { promisify } = util;
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);

import serveBlog from './blog544-ws.js';
import Blog from './blog544.js';
import meta from './meta.js';

/************************** Utility Routines ***************************/

function getPort(portArg) {
  let port = Number(portArg);
  if (!port) usage();
  return port;
}

async function readJson(dir, name) {
  const path = Path.join(dir, name);
  const str = await readFile(path, 'utf8');
  return JSON.parse(str);
}

/*************************** Loading Data *******************************/

async function loadData(blog, dataDir) {
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

/**************************** Top-Level Code ***************************/

const USAGE = `usage: ${Path.basename(process.argv[1])} PORT MONGO_DB_URL ` +
  '[DATA_DIR]';

function usage() {
  console.error(USAGE);
  process.exit(1);
}

async function go(args) {
  try {
    const port = getPort(args[0]);
    const blog = await Blog.make(meta, { dbUrl: args[1], });
    if (args.length > 2) {
      await blog.clear();
      await loadData(blog, args[2]);
    }
    serveBlog(port, meta, blog);
  }
  catch (err) {
    //hopefully we should never get here.
    console.error(err);
  }
}
    

if (process.argv.length != 4 && process.argv.length != 5) usage();
go(process.argv.slice(2));
