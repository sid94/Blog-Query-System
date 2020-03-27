// -*- mode: JavaScript; -*-

import BlogError from './blog-error.js';

import mongo from 'mongodb';

import assert from 'assert';

import Validator from './validator.js';

export default class Data {

  constructor(client, db, meta, options) {
    this.client = client; this.db = db;
    this.meta = metaInfo(meta);
    this.options = options;
    for (const category of CATEGORIES) {
      this[category] = db.collection(category);
    }
  }
    
  /** options.dbUrl contains URL for mongo database */
  static async make(meta, options) {
    const dbUrl = options.dbUrl;
    let client;
    try {
      client = await mongo.connect(dbUrl, MONGO_CONNECT_OPTIONS );
    }
    catch (err) {
      const msg = `cannot connect to URL "${dbUrl}": ${err}`;
      throw [ new BlogError('DB', msg) ];
    }
    const db = client.db();
    const data = new Data(client, db, meta, options);
    await data._createIndexes();
    return data;
  }

  /** Release all resources held by this image store.  Specifically,
   *  close any database connections.
   */
  async close() {
    await this.client.close();
  }

  validator(meta) {
    const xMetaKeyValues =  Object.entries(meta).
	  map(([k, v]) => [k, v.concat( [_ID_PROPS ]) ]);
    const xMeta = Object.fromEntries(xMetaKeyValues);
    return new Validator(xMeta);
  }
  
  async create(category, obj) {
    const id = obj.id || await this._makeId(category);
    const xObj = obj.id === undefined ? Object.assign({}, obj, {id}) : obj;
    const dbObj = toDbObj(xObj);
    const errors = [];
    await this._validateIdentifies(category, obj, errors);
    if (errors.length > 0) throw errors;
    const collection = this[category];
    try {
      await collection.insertOne(dbObj);
    }
    catch (err) {
      if (isDuplicateError(err)) {
	const msg = `${category} object having id ${id} already exists`;
	throw [ new BlogError('EXISTS', msg) ];
      }
      else {
	throw err;
      }
    }
    return id;
  }

  async clear() {
    await this.db.dropDatabase();
  }
  
  async find(category, searchSpec) {
    const collection = this[category];
    const dbSearch = toDbObj(searchSpec);
    const query = makeQuery(dbSearch, this.meta[category]);
    const index =
      searchSpec._index !== undefined ? Number(searchSpec._index) : 0;
    const count =
      searchSpec._count !== undefined ? Number(searchSpec._count) : COUNT;
    const cursor = await collection.
      find(query).
      sort({creationTime: -1 }).
      skip(index).
      limit(count);
    const dbObjs = await cursor.toArray();
    const objs = dbObjs.map(dbObj => fromDbObj(dbObj));
    return objs;
  }

  async update(category, updateSpec) {
    const collection = this[category];
    const dbUpdate = toDbObj(updateSpec);
    const set = Object.assign({}, dbUpdate);
    delete set._id;
    const ret =
      await collection.updateOne({ _id: dbUpdate._id }, { $set: set });
    if (ret.matchedCount !== 1) {
      const msg = `no ${category} for id ${updateSpec.id} in update`;
      throw [ new BlogError('BAD_ID', msg) ];
    }
  }

  async remove(category, removeSpec) {
    const meta = this.meta[category];
    const errors = [];
    //for each category/field which refers to objects in this category
    for (const [cat, field] of meta.identifiedBy) {
      //build string of referring id's from referring categories
      const catIds =
        (await this.find(cat, {[field]: removeSpec.id})).
	map(o => o.id).
        join(', ');
      if (catIds.length > 0) {
	const msg = `${category} ${removeSpec.id} referenced by ${field} ` +
                    `for ${cat} ${catIds}`;
	errors.push(new BlogError('BAD_ID', msg));
      }
    }
    if (errors.length > 0) throw errors;
    const collection = this[category];
    const dbRemove = toDbObj(removeSpec);
    const ret = await collection.deleteOne(dbRemove);
    if (ret.deletedCount !== 1) {
      const msg = `no ${category} for id ${removeSpec.id} in remove`;
      throw [ new BlogError('BAD_ID', msg) ];
    }
  }

  async _createIndexes() {
    const indexes = this.db.collection(INDEXES);
    const didIndexes = (await indexes.countDocuments()) > 0;
    if (!didIndexes) {
      for (const [cat, catInfo] of Object.entries(this.meta)) {
	const collection = this[cat];
	for (const [name, fieldInfo] of Object.entries(catInfo.fields)) {
	  if (fieldInfo.doIndex) {
	    const dir = (fieldInfo.rel === 'geq') ? -1 : 1;
	    await collection.createIndex({[name]: dir});
	    await indexes.insertOne({ [`${cat}-${name}`]: dir });
	  }
	}
      } //for
    } //if !didIndexes
  }

  async _makeId(category) {
    return String(await this[category].countDocuments()) + 
      String(Math.random()).slice(1, 7);
  }


  async _validateIdentifies(category, obj, errors) {
    const meta = this.meta[category];
    for (const [name, otherCategory] of Object.entries(meta.identifies)) {
      const otherId = obj[name];
      if (otherId !== undefined) {
	if ((await this.find(otherCategory, { id: otherId })).length !== 1) {
	  const friendly = meta.fields[name].friendlyName;
	  const msg = `invalid ${friendly} ${otherId} in ${otherCategory} ` +
 		      `for create ${category}`;
	  errors.push(new BlogError('BAD_ID', msg));
	}
      }
    }
  }
    
} //Data

const MONGO_CONNECT_OPTIONS = { useUnifiedTopology: true };

const _ID_PROPS = {
  name: '_id',
  friendlyName: 'internal mongo _id',
  forbidden: [ 'create', 'find', 'remove', 'update', ],
};

const CATEGORIES = [ 'users', 'articles', 'comments' ];
const INDEXES = 'indexes';

//default max count of object values returned from find()
const COUNT = 5;

function toDbObj(obj) {
  const dataKeys = Object.keys(obj).filter(k => !k.startsWith('_'));
  obj = Object.fromEntries(dataKeys.map(k => [k, obj[k]]));
  if (obj.id === undefined) return obj;
  const dbObj = Object.assign({}, obj, {_id: obj.id});
  delete dbObj.id;
  return dbObj;
}

function fromDbObj(dbObj) {
  const obj = Object.assign({}, dbObj, {id: dbObj._id});
  delete obj._id;
  return obj;
}

function isDuplicateError(err) {
  return (err.code === 11000);
}

function makeQuery(search, catMeta) {
  const fields = catMeta.fields;
  const query = {};
  for (const [k, v] of Object.entries(search)) {
    const rel = fields[k] && fields[k].rel;
    if (rel === 'leq') {
      query[k] = { $gte: v };
    }
    else if (rel == 'geq') {
      query[k] = { $lte: v };
    }
    else {
      query[k] = v;
    }
  }
  return query;
}


/** Massage meta into a more useful structure.  Return map[category]
 *  to a map { fields, indexes, identifies, indentifiedBy }:
 *    fields: a map mapping name of each incoming fields in meta to 
 *    all its properties.
 *    indexes: a map from field-names to the indexing relation.
 *    identifies: a map from fields to the category indentified
 *    by that field.
 *    identifiedBy: an array of pairs giving the category, field
 *    by which this category is identified.
 */
function metaInfo(meta) {
  const infos = {};
  for (const [category, fields] of Object.entries(meta)) {
    const indexPairs =
      fields.filter(f => f.doIndex).
      map(f => [ f.name, f.rel || 'eq' ]);
    const indexes = Object.fromEntries(indexPairs);
    const identifiesPairs =
      fields.filter(f => f.identifies).
      map(f => [ f.name, f.identifies ]);
    const identifies = Object.fromEntries(identifiesPairs);
    const fieldsMap = Object.fromEntries(fields.map(f => [f.name, f]));
    infos[category] =
      { fields: fieldsMap, indexes, identifies, identifiedBy: [], };
  }
  for (const [category, info] of Object.entries(infos)) {
    for (const [field, cat] of Object.entries(info.identifies)) {
      infos[cat].identifiedBy.push([category, field]);
    }
  }
  return infos;
}

