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
    this.users = [];
    this.articles = [];
    this.comments =[]
  }

  static async make(meta, options) {
    //@TODO
    return new Blog544(meta, options);
  }

  /** Remove all data for this blog */
  async clear() {
    this.users = [];
    this.articles = [];
    this.comments =[];
  }

  /** Create a blog object as per createSpecs and 
   * return id of newly created object 
   * create users _json=errors/betty77.json id=betty77 firstName=Betty lastName=john email=b@gmail.com roles=[author]
   */
  async create(category, createSpecs) {	  
    const obj = this.validator.validate(category, 'create', createSpecs);
    
    if(category === "users")
    {
      let requestedId = obj.id;
      let found = false;
      for(let i = 0; i < this.users.length; i++) {
      if (this.users[i].id === requestedId) {
        found = true;
        break;
       }
      }
      if(found === false){
      	this.users.push(obj);
      	return obj.id
      }
      else{
        const errormsg = 'object with id ' + obj.id + ' already exists for users';
        throw [new BlogError('EXISTS', errormsg)];
      }
    }
    else if(category === "articles")
    {
      if(!isNullorUndefined(obj.authorId)){
        let userobj = this.users.find(x => x.id === obj.authorId);
        if(!isNullorUndefined(userobj)){
          this.articles.push(randomId(obj));
          return obj.id;
        }
        else
        {
          const errormsg = 'passed authorId ' + obj.authorId + ' does not exists in users';
          throw [new BlogError('BAD_ID', errormsg)];
        }
      }
      else {
        const errormsg = 'authorId not passed';
        throw [new BlogError('BAD_ID', errormsg)];
      }
    }
    else if(category === "comments") {

      if(!isNullorUndefined(obj.articleId) && !isNullorUndefined(obj.commenterId)) {
        let articleobj = this.articles.find(x => x.id === obj.articleId);
        let userobj = this.users.find(x => x.id === obj.commenterId);
        if(!isNullorUndefined(articleobj) && !isNullorUndefined(userobj)){
          this.comments.push(randomId(obj));
          return obj.id
        }
        else {
          const errormsg = 'Passed articleId ' + obj.articleId + ' or commenterID ' + obj.commenterId +  ' does not exists in articles or users';
          throw [new BlogError('BAD_ID', errormsg)];
        }
      }
      else{
        const errormsg = 'articleId and commenterId is required field for comments';
        throw [new BlogError('BAD_ID', errormsg)];
      }
    }
  }

  /** Find blog objects from category which meets findSpec.  Returns
   *  list containing up to findSpecs._count matching objects (empty
   *  list if no matching objects).  _count defaults to DEFAULT_COUNT.
   */
  async find(category, findSpecs={}) {
    const obj = this.
    validator.validate(category, 'find', findSpecs);
    let retArr = [];
    let queryArr = [];
    let val = Object.keys(findSpecs);
      queryArr =  await this.getCategory(category);
      if (isNullorUndefined(findSpecs)) {
        retArr = queryArr.map(obj => (obj));
        retArr = retArr.slice(0,DEFAULT_COUNT);
      } else if (val.length == 1 && !isNullorUndefined(findSpecs._count) && isNullorUndefined(findSpecs.keywords)) {
        let count = findSpecs._count;
        for (let i = 0; i < queryArr.length; i++) {
          if (i < count) {
            retArr.push(queryArr[i]);
          } else {
            break;
          }
        }
      } else if (!isNullorUndefined(findSpecs.keywords)) {
        let count = !isNullorUndefined(findSpecs._count) ? findSpecs._count : queryArr.length;
        let addedObjCount = 1;
        queryArr.forEach(function (newItem) {
          if (findSpecs.keywords.every(val => newItem.keywords.includes(val)) && addedObjCount <= count) {
            retArr.push(newItem);
            addedObjCount += 1;
            if (addedObjCount === count) {
              return retArr
            }
          }
        }, this)
      } else {
        retArr = queryArr.filter(x => x[val[0]] === findSpecs[val[0]]);
      }
      if(isNullorUndefined(retArr)){
        const errormsg = 'no ' + category +' for id ' + findSpecs[val[0]] + ' in find';
        throw [new BlogError('BAD_ID', errormsg)];
      }
    return retArr;
  }

  /** Remove up to one blog object from category with id == rmSpecs.id. */
  async remove(category, rmSpecs) {
    const obj = this.validator.validate(category, 'remove', rmSpecs);

    let key = Object.keys(rmSpecs);
      if (category === "users") {
        let articleIds = [];
        let commentIds = [];
        let user = this.users.filter(x => x[key[0]] === rmSpecs[key[0]]);
        user = user[0];
        if (!isNullorUndefined(user) && !isNullorUndefined(user.roles)) {
          let adminrole = false;
          let that = this;
          user.roles.forEach(function (obj) {
            if (obj === "author") {
              that.articles.filter(function (articleobj) {
                if (articleobj.authorId === user.id) {
                  articleIds.push(articleobj.id);
                }
              })
            } else if (obj === "commenter") {
              that.comments.filter(function (commentobj) {
                if (commentobj.commenterId === user.id) {
                  commentIds.push(commentobj.id);
                }
              })
            } else if (obj === "admin") {
              adminrole = true;

              console.log("throw error you cannot delete admin users")
            }
          });
          if (isNullorUndefined(articleIds) && isNullorUndefined(commentIds) && !adminrole) {
            let index = this.users.findIndex(x => x.id === user.id);
            this.users.splice(index, 1);
          } else {
            if(!isNullorUndefined(articleIds)) {
              console.log("authorId: " + articleIds.length)
            }
            if(!isNullorUndefined(commentIds)){
              console.log("commenterId: " + commentIds.length)
            }
            let errmsg = [];
            if(!isNullorUndefined(articleIds)) {
              errmsg.push(new BlogError('BAD_ID', category + ' ' + user.id + ' referenced by authorId for articles ' + articleIds.toString() + '\n'));
            }
            if(!isNullorUndefined(commentIds)) {
              errmsg.push(new BlogError('BAD_ID',category + ' ' + user.id + ' referenced by commenterId for comments ' + commentIds.toString()));
            }
            if(errmsg.length > 0){
              throw errmsg;
            }
          }
        } else {
          if (isNullorUndefined(user)) {
            const errormsg = 'no ' + category +' for id ' + rmSpecs[key[0]] + ' in remove';
            throw [new BlogError('BAD_ID', errormsg)];
          }
          else if (!isNullorUndefined(user) && isNullorUndefined(user.roles)) {
            let index = this.users.findIndex(x => x.id === user.id);
            this.users.splice(index, 1)
          }
        }
      } else if (category === "comments") {
        let index = this.comments.findIndex(x => x.id === rmSpecs.id);
        if(index != -1){
          this.comments.splice(index, 1);
        }
        else {
          const errormsg = 'no ' + category +' for id ' + rmSpecs[key[0]] + ' in remove';
          throw [new BlogError('BAD_ID', errormsg)];
        }

      }
      else if (category === "articles") {
        let commentIds = [];
        this.comments.filter(function (commentobj) {
          if (commentobj.articleId === rmSpecs.id) {
            commentIds.push(commentobj.id);
          }
        });
        if (!isNullorUndefined(commentIds)) {
          const errmsg = category + ' ' + rmSpecs.id + ' referenced by commenterId for comments ' + commentIds.toString();
          throw [new BlogError('BAD_ID', errmsg)];
        }
        else {
          let index = this.articles.findIndex(x => x.id === rmSpecs.id);
          if(index != -1){
            this.articles.splice(index, 1);
          }
          else {
            const errormsg = 'no ' + category +' for id ' + rmSpecs[key[0]] + ' in remove';
            throw [new BlogError('BAD_ID', errormsg)];
          }
        }
      }
  }

  /** Update blog object updateSpecs.id from category as per
   *  updateSpecs.
   */
  async update(category, updateSpecs) {
    const obj = this.validator.validate(category, 'update', updateSpecs);
    let queryArr = [];
      queryArr =  await this.getCategory(category);
      let val = Object.keys(updateSpecs);
      let index = queryArr.findIndex(x => x[val[0]] === updateSpecs[val[0]]);
      if(index != -1) {
        let obj = queryArr[index];
        let wrgProperty = false;

        for (let i = 0; i < val.length - 1; i++) {
          if (obj.hasOwnProperty(val[i + 1])) {
            obj[val[i + 1]] = updateSpecs[val[i + 1]]
          } else {
            wrgProperty = true;
            break;
          }
        }
        if (!wrgProperty) {
          queryArr[index] = obj;
        }
        else{
          const errormsg = 'One or more property provided for the '+ category+ ' does not exists';
          throw [new BlogError('BAD_ID', errormsg)];
        }
      }
      else
      {
        const errormsg = 'no ' + category +' for id ' + updateSpecs[val[0]] + ' in update';
        throw [new BlogError('BAD_ID', errormsg)];
      }
  }

  async getCategory(category){
    let queryArr = [];
    switch (category) {
      case "comments":
        queryArr = this.comments;
        break;
      case "users":
        queryArr = this.users;
        break;
      case "articles":
        queryArr = this.articles;
        break;
    }
    return queryArr;
  }
}

const DEFAULT_COUNT = 5;

function isNullorUndefined(val){
  return (val === undefined || val == null || val.length <= 0 || Object.keys(val).length === 0 ) ? true : false;
}

function randomId(obj){
  obj.id = ((Math.random() * 1000) + 1).toFixed(2);
  return obj
}
//You can add code here and refer to it from any methods in Blog544.
