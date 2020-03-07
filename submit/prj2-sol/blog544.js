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
    this.options = options;
    this.client = options.client;
    this.db = options.db;
    this.validator = new Validator(meta);
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
      throw [ new BlogError(`BAD URL', 'Use url as mongodb://HOST:PORT/DB`) ];
    }
    return new Blog544(meta, options);
  }

  /** Release all resources held by this blog.  Specifically, close
   *  any database connections.
   */
  async close() {
    //@TODO
    //await this.client.close();
  }

  /** Remove all data for this blog */
  async clear() {
    //@TODO
  }

  /** Create a blog object as per createSpecs and 
   * return id of newly created object 
   */
  async create(category, createSpecs) {
    const obj = this.validator.validate(category, 'create', createSpecs);
    assert.equal(await this.find(category,{id:obj._id}),[]);
    if(category === 'users') {
      await this.users.insertMany([obj], function (err, result) {
        assert.equal(err, null);
        //console.log("Inserted 1 documents into the collection");
      });
    }else if(category === 'articles'){
      await this.articles.insertMany([randomId(obj)], function (err, result) {
        assert.equal(err, null);
        //console.log("Inserted 1 documents into the collection");
      });
    }
    else{
      await this.comments.insertMany([randomId(obj)], function (err, result) {
        assert.equal(err, null);
        //console.log("Inserted 1 documents into the collection");
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
    let sortCriteria = findSpecs.hasOwnProperty('_index') ? {creationTime : findSpecs._index } : {};
    let findCriteria;
    if(['id','authorId','articleId','commenterId'].includes(keys[0]))
    { let a; if(keys[0] === 'id' ) {a = '_id'} else { a = keys[0] } ;findCriteria = { [a] : findSpecs[keys[0]]};}
    else { findCriteria = findSpecs.hasOwnProperty('creationTime') ? {'creationTime' : { $lte : new Date(findSpecs.creationTime) }} : {}; }
    let result = await collection.find(findCriteria).limit(parseInt(findSpecs._count) || DEFAULT_COUNT).sort(sortCriteria).toArray();
    result = result.map(val => {val.id = val._id; delete val._id; return val});
    return result;
  }

  /** Remove up to one blog object from category with id == rmSpecs.id. */
  async remove(category, rmSpecs) {
    const obj = this.validator.validate(category, 'remove', rmSpecs);
    //@TODO
  }

  /** Update blog object updateSpecs.id from category as per
   *  updateSpecs.
   */
  async update(category, updateSpecs) {
    const obj = this.validator.validate(category, 'update', updateSpecs);
    //@TODO
  }

  static async connect(dbUrl){
    const mongoClient = new mongo.MongoClient(dbUrl, MONGO_CONNECT_OPTIONS);
    await mongoClient.connect(function(err) {
      assert.equal(null, err);
      console.log("Connected successfully to server");
    });
    return {
      client:mongoClient,
      db:mongoClient.db('data')
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

const MONGO_CONNECT_OPTIONS = { useUnifiedTopology: true, useNewUrlParser: true };

function isNullorUndefined(val){
  return (val === undefined || val == null || val.length <= 0 || Object.keys(val).length === 0);
}

function randomId(obj){
  obj._id = ((Math.random() * 1000) + 1).toFixed(4);
  return obj
}
