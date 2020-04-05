import assert from 'assert';
import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';
import querystring from 'querystring';

import BlogError from './blog-error.js';

const OK = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

export default function serve(port, meta, model) {
  const app = express();
  app.locals.port = port;
  app.locals.meta = meta;
  app.locals.model = model;
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

function setupRoutes(app) {
  app.use(cors());
  app.use(bodyParser.json());
  //@TODO
  app.get('/', appNavigation(app));
  app.get('/meta', metaInfo(app));
  app.get('/users/:id', findInfoById(app,'users'));
  app.get('/articles/:id', findInfoById(app,'articles'));
  app.get('/comments/:id', findInfoById(app,'comments'));
  app.get('/users', categoryInfo(app));
  app.get('/articles', categoryInfo(app));
  app.get('/comments', categoryInfo(app));
  app.delete('/users/:id', deleteInfoById(app,'users'));
  app.delete('/articles/:id', deleteInfoById(app,'articles'));
  app.delete('/comments/:id', deleteInfoById(app,'comments'));
  app.post('/users', createById(app,'users'));
  app.post('/articles', createById(app,'articles'));
  app.post('/comments', createById(app,'comments'));
  app.patch('/users/:id', updateById(app,'users'));
  app.patch('/articles/:id', updateById(app,'articles'));
  app.patch('/comments/id', updateById(app,'comments'));
  app.use(doErrors());

}

/****************************** Handlers *******************************/

function appNavigation(app) {
  return errorWrap( function(req, res) {
    try {
      let url = requestUrl(req);
      let metaKeys = Object.keys(app.locals.meta);
      metaKeys.push("self");
      metaKeys.push("meta");
      let resArr = [];
      let resObj = {};
      metaKeys.forEach((val,i,arr)=> {
        let obj = {};
        if(val === "self"){
          obj =  hateoas(url,val,val);
        }
        else if(val === "meta") {
          obj =  hateoas(url,val,"describedby",{},val);
        }
        else{
          obj =  hateoas(url,val,"collections",{},val);
        }
        resArr.push(obj);
      });
      resObj.links = resArr;
      //res.send("hello world");
      res.json(resObj);
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  }
  )
}

function metaInfo(app) {
  return errorWrap(function (req,res) {
    try {
      let url = requestUrl(req);
      let meta = Object.assign({},app.locals.meta);
      let hatObj = hateoas(url,'self','self');
      hatObj.href = hatObj.url; delete hatObj.url;
      meta.links = [hatObj];
      res.json(meta);
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  })
}

function categoryInfo(app) {
  return errorWrap(async function (req,res) {
    try {
      let resObj = {};
      const q = req.query || {};
      let reqUrl = requestUrl(req);
      let cat = reqUrl.substring(reqUrl.lastIndexOf("/")+1, reqUrl.length + 1);
      let catObj = await app.locals.model.find(cat,q);
      catObj.forEach((val,i,arr)=>{
        let a = hateoas(reqUrl,'self','self',q,val.id);
        a.href = a.url; delete a.url;
        val.links = [a];
      });
      let links = [];
      if(q.hasOwnProperty('_count') && q.hasOwnProperty('_index')){
        if(catObj.length >=  q._count){const nextLink = hateoas(reqUrl,'next','next',q,"",resObj);links.push(nextLink); }
        if(q._index > 0){const prevLink = hateoas(reqUrl,'prev','prev',q,"",resObj);links.push(prevLink); }
      }
      else if (q.hasOwnProperty('_count')) {
        let queryS = Object.assign({},q);
        queryS._index = 0;
        if(catObj.length >=  q._count){const nextLink = hateoas(reqUrl,'next','next',queryS,"",resObj);links.push(nextLink); }
      }
      else if(q.hasOwnProperty('_index')){
        if(catObj.length > 0 && catObj.length >= q._index) { const nextLink = hateoas(reqUrl,'next','next',q,"",resObj);links.push(nextLink); }
        if(q._index > 0){const prevLink = hateoas(reqUrl,'prev','prev',q,"",resObj);links.push(prevLink);}
      }
      else if(!q.hasOwnProperty('_count') && !q.hasOwnProperty('_index') && !isNullorUndefined(q)){

        if(catObj.length >= DEFAULT_COUNT){ q._index = 0; const nextLink = hateoas(reqUrl,'next','next',q,"",resObj);links.push(nextLink);}
      }
      else if(isNullorUndefined(q)){
        if(catObj.length >= DEFAULT_COUNT){const nextLink = hateoas(reqUrl,'next','next',q,"",resObj); links.push(nextLink);}
      }
      const selfLink = hateoas(reqUrl,'self','self',q);
      links.push(selfLink);
      resObj[cat] = catObj;
      resObj.links = links;
      res.json(resObj);
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  })
}

function findInfoById(app,category) {
  return errorWrap(async function (req,res) {
    try {
      //used simpsons users-ws code directly
      let resObj = {};
      let reqUrl = requestUrl(req);
      let arr = await app.locals.model.find(category,req.params);
      if(!isNullorUndefined(arr)){
        let obj = arr[0];
        let a = hateoas(reqUrl,'self','self');a.href = a.url; delete a.url;
        obj.links = [a];
        resObj[category] = obj;
        res.send(resObj);
      }else{res.json({ [category] : arr })}
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  })
}

function deleteInfoById(app,category) {
  return errorWrap(async function (req,res) {
    try {
      //used simpsons users-ws code directly
      const id = req.params.id;
      const results = await app.locals.model.remove(category,{ id: id });
      res.json({})
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  })
}

function createById(app,category) {
  return errorWrap(async function (req,res) {
    try {
      //used simpsons users-ws code directly
      const obj = req.body;
      const results = await app.locals.model.create(category,obj);
      res.append('Location', requestUrl(req) + '/' + results.id);
      res.json({});
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  })
}

function updateById(app, category) {
  return errorWrap(async function (req,res) {
    try {
      //used simpsons users-ws code directly
      const patch = Object.assign({}, req.body);
      patch.id = req.params.id;
      const results = await app.locals.model.update(category,patch);
      res.json({});
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  })
}

//@TODO

/**************************** Error Handling ***************************/

/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    res.status(SERVER_ERROR);
    await res.json({ code: 'SERVER_ERROR', message: err.message });
    console.error(err);
  };
}

/** Set up error handling for handler by wrapping it in a 
 *  try-catch with chaining to error handler on error.
 */
function errorWrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    }
    catch (err) {
      next(err);
    }
  };
}

const ERROR_MAP = {
  BAD_CATEGORY: NOT_FOUND,
  EXISTS: CONFLICT,
};

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code.
 */
function mapError(err) {
  console.error(err);
  return (err instanceof Array && err.length > 0 && err[0] instanceof BlogError)
    ? { status: (ERROR_MAP[err[0].code] || BAD_REQUEST),
	code: err[0].code,
	message: err.map(e => e.message).join('; '),
      }
    : { status: SERVER_ERROR,
	code: 'INTERNAL',
	message: err.toString()
      };
} 

/****************************** Utilities ******************************/



/** Return original URL for req (excluding query params)
 *  Ensures that url does not end with a /
 */
function requestUrl(req) {
  const port = req.app.locals.port;
  const url = req.originalUrl.replace(/\/?(\?.*)?$/, '');
  return `${req.protocol}://${req.hostname}:${port}${url}`;
}

function isNullorUndefined(val){
  return (val === undefined || val == null || val.length <= 0 || Object.keys(val).length === 0);
}

function hateoas(link,name,rel,q = {},param,resObj){
  try{
    let query  = Object.assign({}, q);
    param = param || '';
    param = isNullorUndefined(param) ? param : '/'+ param;
    let queryString='';
    if(isNullorUndefined(param)) {
      let prevIndex, nextIndex;
      if (query.hasOwnProperty('_count') && query.hasOwnProperty('_index') && name !== "self") {
        prevIndex = parseInt(query._index) - parseInt(query._count); prevIndex = prevIndex < 0 ? 0 : prevIndex;
        nextIndex = parseInt(query._index) + parseInt(query._count);
        if (name === "prev") {query._index = prevIndex; resObj.prev = prevIndex} else {query._index = nextIndex; resObj.next = nextIndex;}
      }
      else if (query.hasOwnProperty('_count') && name !== "self") {
        //prevIndex = parseInt(query._index) - parseInt(query._count);
        nextIndex = parseInt(query._index) + parseInt(query._count);
        if (name === "prev") {query._index = prevIndex; resObj.prev = prevIndex} else {query._index = nextIndex;  resObj.next = nextIndex;}
      }
      else if (query.hasOwnProperty('_index') && name !== "self") {
        prevIndex = parseInt(query._index) - DEFAULT_COUNT; prevIndex = prevIndex < 0 ? 0 : prevIndex;
        nextIndex = parseInt(query._index) + DEFAULT_COUNT;
        if (name === "prev") {query._index = prevIndex; resObj.prev = prevIndex;} else {query._index = nextIndex;resObj.next = nextIndex;}
      }
      else if (isNullorUndefined(query)) {
        nextIndex = DEFAULT_COUNT;
        if (name === "next") {query._index = nextIndex; resObj.next = nextIndex;}
      }
      queryString = Object.keys(query).map(key => key + '=' + query[key]).join('&');
      queryString = isNullorUndefined(queryString) ? '' : '?'+ queryString;
    }

    let retObj = { url :name === "prev" ? link + param + queryString :  link + param + queryString ,name : name , rel : rel };
    return retObj
  }
  catch(e){
    console.log(e);
  }
}

const DEFAULT_COUNT = 5;

//@TODO
