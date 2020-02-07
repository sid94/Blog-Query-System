// -*- mode: JavaScript; -*-

import BlogError from './blog-error.js';

export default class Validator {

  constructor(meta) {
    const xInfo = {};
    const actions = {};
    for (const [category, infos] of Object.entries(meta)) {
      xInfo[category] =
	Object.fromEntries(infos.map(info => [info.name, info]));
      actions[category] = makeActions(infos);
    }
    this.meta = xInfo;
    this.actionFields = actions;
  }

  validate(category, act, obj) {
    const out = {};
    const infos = this.meta[category];
    if (!infos) {
      throw [ new BlogError(`BAD_CATEGORY', 'unknown category ${category}`) ];
    } 
    const errors = [];
    const required = new Set(this.actionFields[category][act].required);
    const { forbidden, optional } = this.actionFields[category][act];
    const msgSuffix = `for ${category} ${act}`;
    for (const [name, value] of Object.entries(obj)) {
      required.delete(name);
      const info = infos[name];
      if (name.startsWith('_')) {
	out[name] = value;
      }
      else if (info === undefined) {
	const msg = `unknown ${category} field ${name} ${msgSuffix}`;
	errors.push(new BlogError('BAD_FIELD', msg));
      }
      else if (forbidden.has(name)) {
	const msg = `the ${info.friendlyName} field is forbidden ${msgSuffix}`;
	errors.push(new BlogError('BAD_FIELD', msg));
      }
      else if (info.checkFn && !info.checkFn(value)) {
	const msg = `bad value: ${value}; ${info.checkError} ${msgSuffix}`;
	errors.push(new BlogError('BAD_FIELD_VALUE', msg));
      }
      else {
	out[name] = info.data ? info.data(value) : value;
      }
    } //for
    if (required.size > 0) {
      const names = Array.from(required).
	    map(n => infos[n].friendlyName).
	    join(', ');
      errors.push(new BlogError('MISSING_FIELD',
				`missing ${names} fields ${msgSuffix}`));
    }
    if (errors.length > 0) throw errors;
    for (const name of optional) { //fill in default value for optional fields
      if (out[name] === undefined && infos[name].defaultFn !== undefined) {
	out[name] = infos[name].defaultFn();
      }
    }
    return out;
  }
  
};

function makeActions(infos) {
  const acts = [ 'create', 'find', 'update', 'remove', ];
  const pairs =
    acts.map(a => [a, { required: new Set(), forbidden: new Set(), }]);
  const actions = Object.fromEntries(pairs);
  for (const info of infos) {
    const name = info.name;
    for (const k of [ 'required', 'forbidden' ]) {
      for (const act of info[k] || []) {
	actions[act][k].add(name);
      }
    }
  }
  const names = infos.map(info => info.name);
  for (const act of acts) {
    const actInfo = actions[act];
    actInfo.optional = new Set();
    for (const name of names) {
      if (!actInfo.required.has(name) && !actInfo.forbidden.has(name)) {
	actInfo.optional.add(name);
      }
    }
  }
  return actions;
}

/*
import util from 'util';
import meta from './meta.mjs';
console.log(util.inspect(new Validator(meta), false, null));
*/
