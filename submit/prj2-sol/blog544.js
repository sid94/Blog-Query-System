// -*- mode: JavaScript; -*-

import mongo from 'mongodb';

import BlogError from './blog-error.js';
import Validator from './validator.js';
import assert from 'assert';

//debugger; //uncomment to force loading into chrome debugger

/**
A blog contains users, articles and comments.  Each user can have
multiple Role's from [ 'admin', 'author', 'commenter' ]. An author can
create/update/remove articles.  A commenter can comment on a specific
article.

Errors
======

DB:
  Database error

BAD_CATEGORY:
  Category is not one of 'articles', 'comments', 'users'.

BAD_FIELD:
  An object contains an unknown field name or a forbidden field.

BAD_FIELD_VALUE:
  The value of a field does not meet its specs.

BAD_ID:
  Object not found for specified id for update/remove
  Object being removed is referenced by another category.
  Other category object being referenced does not exist (for example,
  authorId in an article refers to a non-existent user).

EXISTS:
  An object being created already exists with the same id.

MISSING_FIELD:
  The value of a required field is not specified.

*/

export default class Blog544 {

  constructor(meta, options) {
    //@TODO
    this.meta = meta;
    this.indexes = getEligibleIndexes(meta);
    this.options = options;
    this.client = options.client;
    this.db = options.db;
    this.client1 = {};
    this.db1 = {};
    this.validator = new Validator(meta);
    this.usersIndex = this.db.collection('users').createIndexes(this.indexes.users);
    this.articlesIndex = this.db.collection('articles').createIndexes(this.indexes.articles);
    this.commentsIndex = this.db.collection('comments').createIndexes(this.indexes.comments);
    this.users = this.db.collection('users');
    this.articles = this.db.collection('articles');
    this.comments = this.db.collection('comments');
  }

  /** options.dbUrl contains URL for mongo database */
  static async make(meta, options) {
    if(!isNullorUndefined(options) && !isNullorUndefined(options.dbUrl) && /(mongodb:)\/\/([a-z]+\:[0-9]+)/.test(options.dbUrl)){
      const dbDet = await this.connect(options.dbUrl);
      if(!isNullorUndefined(dbDet) && !isNullorUndefined(dbDet.client) && !isNullorUndefined(dbDet.db)){
        options.client  = dbDet.client; options.db = dbDet.db;
      }else{
        throw [ new BlogError(`DB FAILURE', 'Unable to connect to DB`) ];
      }
    }
    else {
      throw [ new BlogError(`BAD URL', 'Use url as mongodb://HOST:PORT`) ];
    }
    return new Blog544(meta, options);
  }

  /** Release all resources held by this blog.  Specifically, close
   *  any database connections.
   */
  async close() {
    //@TODO
    await this.client.close();
  }

  /** Remove all data for this blog */
  async clear() {
    //@TODO
    await this.users.deleteMany({});
    await this.articles.deleteMany({});
    await this.comments.deleteMany({});
  }

  /** Create a blog object as per createSpecs and 
   * return id of newly created object 
   */
  async create(category, createSpecs) {
    const obj = this.validator.validate(category, 'create', createSpecs);
    if(category === 'users') {
      const userExist = await this.find(category,{id:obj._id});
      if(!isNullorUndefined(userExist)){
        const errorMsg = 'object with id ' + obj._id + ' already exists for users';
        throw [new BlogError('EXISTS', errorMsg)];
      }
      await this.users.insertMany([obj], function (err, result) {
        //assert.equal(err, null);
        //console.log("Inserted 1 documents into the collection");
      });
    }else if(category === 'articles'){
      let article = randomId(obj);
      const userExist = await this.find('users',{id:obj.authorId});
      if(isNullorUndefined(userExist)){
        const errorMsg = 'Author Id' +obj.authorId + ' associated with this article does not exists for users';
        throw [new BlogError('EXISTS', errorMsg)];
      }
      const articleExist = await this.find(category,{id:article._id});
      if(!isNullorUndefined(articleExist)){
        const errorMsg = 'object with id ' + article._id + ' already exists for articles';
        throw [new BlogError('EXISTS', errorMsg)];
      }
      await this.articles.insertMany([article], function (err, result) {
        //assert.equal(err, null);
      });
    }
    else{
      let comment = randomId(obj);
      let articleExist  = await this.find('articles',{id:obj.articleId});
      if(isNullorUndefined(articleExist)){
        const errorMsg = 'Article Id' +obj.articleId + ' associated with this comment does not exists for articles';
        throw [new BlogError('EXISTS', errorMsg)];
      }
      let commentExist = await this.find(category,{id:obj._id});
      if(!isNullorUndefined(commentExist)){
        const errorMsg = 'object with id ' + obj._id + ' already exists for comments';
        throw [new BlogError('EXISTS', errorMsg)];
      }
      await this.comments.insertMany([comment], function (err, result) {
        //assert.equal(err, null);
      });
    }
    return obj._id;
  }

  /** Find blog objects from category which meets findSpec.  
   *
   *  First returned result will be at offset findSpec._index (default
   *  0) within all the results which meet findSpec.  Returns list
   *  containing up to findSpecs._count (default DEFAULT_COUNT)
   *  matching objects (empty list if no matching objects).  _count .
   *  
   *  The _index and _count specs allow paging through results:  For
   *  example, to page through results 10 at a time:
   *    find() 1: _index 0, _count 10
   *    find() 2: _index 10, _count 10
   *    find() 3: _index 20, _count 10
   *    ...
   *  
   */
  async find(category, findSpecs={}) {
    const obj = this.validator.validate(category, 'find', findSpecs);
    let keys = Object.keys(findSpecs);
    const collection = await this.getCategory(category);
    let findCriteria;
    if(['id','authorId','articleId','commenterId'].includes(keys[0]))
    { let a; if(keys[0] === 'id' ) {a = '_id'} else { a = keys[0] } ;findCriteria = { [a] : findSpecs[keys[0]]};}
    else { findCriteria = findSpecs.hasOwnProperty('creationTime') ? {'creationTime' : { $lte : new Date(findSpecs.creationTime) }} : {}; }
    let result = await collection.find(findCriteria).sort({creationTime:-1}).skip(parseInt(findSpecs._index) || DEFAULT_INDEX).limit(parseInt(findSpecs._count) || DEFAULT_COUNT).toArray();
    result = result.map(val => {val.id = val._id; delete val._id; return val});
    return result;
  }

  /** Remove up to one blog object from category with id == rmSpecs.id. */
  async remove(category, rmSpecs) {
    const obj = this.validator.validate(category, 'remove', rmSpecs);
    if(!isNullorUndefined(await this.find(category,{id : rmSpecs.id}))) {
      if (category === 'users') {
        const articles = await this.find('articles',{authorId: rmSpecs.id});
        const comments = await this.find('comments',{commenterId: rmSpecs.id});
        let errmsg = [];
        if (!isNullorUndefined(articles)) {
          errmsg.push(new BlogError('BAD_ID', category + ' ' + rmSpecs.id + ' referenced by authorId for articles ' + articles.map(val => val.id).toString() + '\n'));
        }
        if (!isNullorUndefined(comments)) {
          errmsg.push(new BlogError('BAD_ID', category + ' ' + rmSpecs.id+ ' referenced by commenterId for comments ' + comments.map(val => val.id).toString()));
        }
        if (errmsg.length > 0) {
          throw errmsg;
        }else {
          await this.users.remove({_id: rmSpecs.id});
        }
      } else if (category === 'articles') {
        const comments = await this.find('comments',{articleId: rmSpecs.id});
        if (comments.length === 0) {
          await this.articles.remove({_id: rmSpecs.id});
        }else {
          const errmsg = category + ' ' + rmSpecs.id + ' referenced by articleId  for comments ' + comments.map(val => val.id).toString();
          throw [new BlogError('BAD_ID', errmsg)];
        }
      } else {
        await this.comments.remove({_id: rmSpecs.id});
      }
    }else {
      const errormsg = 'no ' + category +' for id ' + rmSpecs.id + ' in remove';
      throw [new BlogError('BAD_ID', errormsg)];
    }
  }

  /** Update blog object updateSpecs.id from category as per
   *  updateSpecs.
   */
  async update(category, updateSpecs) {
    const obj = this.validator.validate(category, 'update', updateSpecs);
    let keys = Object.keys(updateSpecs);
    const collection = await this.getCategory(category);
    let updateCriteria , findCriteria;
    if(['id','authorId','articleId','commenterId'].includes(keys[0]))
    { let a; if(keys[0] === 'id' ) {a = '_id'} else { a = keys[0] } ; updateCriteria = { [a] : updateSpecs[keys[0]]}; findCriteria =  keys[0] === 'id' ?{id: updateSpecs[keys[0]]} : {[keys[0]]: updateSpecs[keys[0]]}}
    const objExist = await this.find(category,findCriteria);
    if(isNullorUndefined(objExist)){
      const errorMsg = 'no ' + category +' for ' + keys[0] + " = " + updateSpecs[keys[0]] + ' in update';
      throw [new BlogError('BAD_ID', errorMsg)];
    }
    delete updateSpecs[keys[0]];
    const result = await collection.updateMany(updateCriteria, {$set: updateSpecs});
  }

  static async connect(dbUrl){
    const mongoClient = new mongo.MongoClient(dbUrl,MONGO_CONNECT_OPTIONS);
    const client = await mongoClient.connect();
    return {
      client:client,
      db:client.db('data')
    }
  }

  async getCategory(category){
    let collection;
    switch (category) {
      case "comments":
        collection = this.comments;
        break;
      case "users":
        collection = this.users;
        break;
      case "articles":
        collection = this.articles;
        break;
    }
    return collection;
  }
}

const DEFAULT_COUNT = 5;
const DEFAULT_INDEX = 0;

const MONGO_CONNECT_OPTIONS = {useUnifiedTopology: true};

function isNullorUndefined(val){
  return (val === undefined || val == null || val.length <= 0 || Object.keys(val).length === 0);
}

function randomId(obj){
  obj._id = ((Math.random() * 1000) + 1).toFixed(5);
  return obj
}

function getEligibleIndexes(meta){
  let indexes = {};
  for (const [category, fields] of Object.entries(meta)) {
    indexes[category] = fields.filter(f => f.doIndex).map((f) =>{ return {key : {[f.name]:1} } });
  }
  return indexes;
}
