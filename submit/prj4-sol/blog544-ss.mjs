//-*- mode: javascript -*-

import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import Path from 'path';
import mustache from 'mustache';
import querystring from 'querystring';

const STATIC_DIR = 'statics';
const TEMPLATES_DIR = 'templates';

//emulate commonjs __dirname in this ES6 module
const __dirname = Path.dirname(new URL(import.meta.url).pathname);

export default function serve(port, ws) {
  const app = express();
  app.locals.port = port;
  app.locals.ws = ws;       //web service wrapper
  //process.chdir(__dirname); //so paths relative to this dir work
  process.chdir("C:\\Siddhesh\\projects\\i544\\submit\\prj4-sol");
  setupTemplates(app);
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

/******************************** Routes *******************************/

function setupRoutes(app) {
  app.use('/', express.static(STATIC_DIR));
  app.get('/users', listUsers(app,'users'));
  app.get('/search/users', doSearch(app,'users'));
  //@TODO add routes to handlers
  app.use(doErrors(app)); //must be last   
}

/****************************** Handlers *******************************/

//@TODO: add handlers

function doErrors(app) {
  return async function(err, req, res, next) {
    console.log('doErrors()');
    const errors = [ `Server error` ];
    const html = doMustache(app, `errors`, {errors, });
    res.send(html);
    console.error(err);
  };
}

function listUsers(app,category) {
  return async function(req, res) {
    let resObj = undefined;
    if(req.query.hasOwnProperty("_json")){
      delete req.query["_json"];
      resObj = await app.locals.ws.list(category,req.query || {});
      await res.json(resObj);
    }else {
      resObj = await app.locals.ws.list(category,req.query || {});
      resObj = dateFormattersAdd(resObj);
      resObj = nextprev(resObj,req.query);
      const html = doMustache(app, 'summary',resObj);
      res.send(html);
    }
  };
}

function doSearch(app,category) {
  return async function(req, res) {
    const isSubmit = req.query.submit !== undefined;
    let resObj = {};
    let errors = undefined;
    const search = getNonEmptyValues(req.query);
    if (isSubmit) {
      errors = validate(search);
      if (Object.keys(search).length == 0) {
        const msg = 'One or more values must be specified.';
        errors = Object.assign(errors || {}, { _: msg });
      }
      if (!errors) {
        try {
          resObj = await app.locals.ws.list(category,search);
        }
        catch (err) {
          errors = wsErrors(err);
        }
        if (Object.keys(errors).length === 0 && Object.keys(resObj).length > 0 &&  resObj.users.length === 0 ) {
          errors = {_: 'No users found for specified query'};
        }
      }
    }
    let model, template;
    if (Object.keys(resObj).length > 0 && resObj.users.length > 0) {
      let q = querystring.stringify(search);
      res.redirect('/users?' + q);
    }
    else {
      template =  'search';
      model = errorModel(app, search, errors);
      const html = doMustache(app, template, model);
      res.send(html);
    }
  };
}

/************************** Field Utilities ****************************/

/** Return copy of FIELDS with values and errors injected into it. */
function fieldsWithValues(values, errors={}) {
  return FIELDS.map(function (info) {
    const name = info.name;
    const extraInfo = { value: values[name] };
    if (errors[name]) extraInfo.errorMessage = errors[name];
    if(name === "id"){ extraInfo.id = "userId" ; extraInfo.errId = "userIdErr" }
    return Object.assign(extraInfo, info);
  });
}

/** Given map of field values and requires containing list of required
 *  fields, validate values.  Return errors hash or falsy if no errors.
 */
function validate(values, requires=[]) {
  const errors = {};
  requires.forEach(function (name) {
    if (values[name] === undefined) {
      errors[name] =
          `A value for '${FIELDS_INFO[name].label}' must be provided`;
    }
  });
  for (const name of Object.keys(values)) {
    const fieldInfo = FIELDS_INFO[name];
    const value = values[name];
  }
  return Object.keys(errors).length > 0 && errors;
}

function getNonEmptyValues(values) {
  const out = {};
  Object.keys(values).forEach(function(k) {
    if (FIELDS_INFO[k] !== undefined) {
      const v = values[k];
      if (v && v.trim().length > 0) out[k] = v.trim();
    }
  });
  return out;
}

/** Return a model suitable for mixing into a template */
function errorModel(app, values={}, errors={}) {
  return {
    base: app.locals.base,
    errors: errors._,
    fields: fieldsWithValues(values, errors)
  };
}


/************************ General Utilities ****************************/

/** Set up error handling for handler by wrapping it in a 
 *  try-catch with chaining to error handler on error.
 */

const FIELDS_INFO = {
  id: {
    label: 'User ID',
    isSearch: true
  },
  email: {
    label: 'User Email',
    isSearch: true
  },
  firstName: {
    label: 'First Name',
    isSearch: true
  },
  lastName: {
    label: 'Last Name',
    isSearch: true
  },
  creationTime: {
    label: 'ISO Creation Time',
    isSearch: true
  }
};

const FIELDS =
    Object.keys(FIELDS_INFO).map((n) => Object.assign({name: n}, FIELDS_INFO[n]));

function errorWrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    }
    catch (err) {
      console.log('errorWrap()');
      next(err);
    }
  };
}

function isNonEmpty(v) {
  return (v !== undefined) && v.trim().length > 0;
}

function nextprev(users,q) {
  if(users.hasOwnProperty("next")){q._index = users.next; users.next = querystring.stringify(q);}
  if(users.hasOwnProperty("prev")){q._index = users.prev; users.prev = querystring.stringify(q);}
  return users
}

/************************ Mustache Utilities ***************************/

/** Decode an error thrown by web services into an errors hash
 *  with a _ key.
 */
function wsErrors(err) {
  let errorMsg =  {};
  if(err.errors !== undefined && err.errors.length > 0){
    let msg = err.errors.map((obj)=>{
      errorMsg[obj.name] = obj.message;
    });
  }
  else{
    errorMsg._ = "web service error";
  }
  return errorMsg;
}




function doMustache(app, templateId, view) {
  const templates = { footer: app.templates.footer };
  return mustache.render(app.templates[templateId], view, templates);
}

function dateFormattersAdd(obj){
  obj.formatCreationDate = function () {
    let date = new Date (this.creationTime);
    return (1 + date.getMonth()).toString() + '/' + date.getDate().toString() + '/' + date.getFullYear();
  };
  obj.formatUpdationDate = function () {
    let date = new Date (this.creationTime);
    return (1 + date.getMonth()).toString() + '/' + date.getDate().toString() + '/' + date.getFullYear();
  };
  return obj
}

function setupTemplates(app) {
  app.templates = {};
  for (let fname of fs.readdirSync(TEMPLATES_DIR)) {
    const m = fname.match(/^([\w\-]+)\.ms$/);
    if (!m) continue;
    try {
      app.templates[m[1]] =
	String(fs.readFileSync(`${TEMPLATES_DIR}/${fname}`));
    }
    catch (e) {
      console.error(`cannot read ${fname}: ${e}`);
      process.exit(1);
    }
  }
}

