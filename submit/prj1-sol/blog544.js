// -*- mode: JavaScript; -*-

import BlogError from './blog-error.js';
import Validator from './validator.js';

//debugger; //uncomment to force loading into chrome debugger

/**
A blog contains users, articles and comments.  Each user can have
multiple Role's from [ 'admin', 'author', 'commenter' ]. An author can
create/update/remove articles.  A commenter can comment on a specific
article.

Errors
======

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
    this.validator = new Validator(meta);
    this.users = []
    this.articles = []
    this.comments =[]
  }

  static async make(meta, options) {
    //@TODO
    return new Blog544(meta, options);
  }

  /** Remove all data for this blog */
  async clear() {
    //@TODO
  }

  /** Create a blog object as per createSpecs and 
   * return id of newly created object 
   * create users _json=errors/betty77.json id=betty77 firstName=Betty lastName=john email=b@gmail.com roles=[author]
   */
  async create(category, createSpecs) {	  
    const obj = this.validator.validate(category, 'create', createSpecs);
    
    if(category == "users")
    {
      let requestedId = obj.id
      var found = false;
      for(var i = 0; i < this.users.length; i++) {
      if (this.users[i].id == requestedId) {
        found = true;
        break;
       }
      }
      if(found == false){
      	this.users.push(obj);
      }
      else{
	 console.log("Id Already exist So dont add the entry")
      }
    }
    else if(category == "articles")
    {
      this.articles.push(obj);
    }
    else if(category == "comments")
    {
      this.comments.push(obj)
    }
    //@TODO
  }

  /** Find blog objects from category which meets findSpec.  Returns
   *  list containing up to findSpecs._count matching objects (empty
   *  list if no matching objects).  _count defaults to DEFAULT_COUNT.
   */
  async find(category, findSpecs={}) {
    const obj = this.validator.validate(category, 'find', findSpecs);
    let retArr = []
    let  count = findSpecs._count
    if(category == "users"){
      if(Object.keys(findSpecs).length === 0 && findSpecs.constructor === Object){
        retArr = this.users.map(user =>({ id : user.id}))
      }
      else if(findSpecs != undefined && findSpecs != null && findSpecs._count != undefined)
      {
        for (var i = 0; i < this.users.length; i++) {
          if(i < count){
            retArr.push({id : this.users[i].id});
          }
          else
          {
            break;
          }
        }
      }
      else
      {
        retArr.push(this.users.find(x => x.id === findSpecs.id));
      }
    }
    return retArr;
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

  
}

//You can add code here and refer to it from any methods in Blog544.
