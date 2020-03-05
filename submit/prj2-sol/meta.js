// -*- mode: JavaScript; -*-

/**
Field properties:

  name:         Internal name of field.  Required.
  friendlyName: External name of field.  Required.
  checkFn:      Validation function (returns truthy if valid). 
  checkError:   Error message if validation fails.  Required if checkFn
  identifies:   Category in which this field uniquely identifies an object.
  rel:          Can be searched for using this relation.
  doIndex:      If true, then find should be facilitated by an index.
  required:     List of actions for which this field must be specified.
  forbidden:    List of actions for which this field must not be specified.

Every object has an id field which is used to uniquely identify that
object within its category.  Note that id fields are alway index
fields, i.e. doIndex is implicitly true.  The id field is either
required during create in which case it must be provided externally,
or it is forbidden during create in which case it must be generated
internally.

If a field identifies a category, then its value is the id of an
object belonging to that category.

If a field is not forbidden or required for an action, then it is
optional for that action.

The rel field can be one of 'eq', 'leq', 'geq' or 'array_eq', giving
the relationship which must hold between the value of the search field
and the value of the field in all retrieved objects.  If not specified,
then it defaults to 'eq'.  Note that if rel is `leq` and the field
value is specified for a find action, then all retrieved values
must be >= the specified value; similarly, if rel is `geq` and the field
value is specified for a find action, then all retrieved values
must be <= the specified value; 

The `array_eq` value for the index property means to index by equality
on all elements of the field value which must be an array.  If
multiple keywords are specified during a find, then all those keywords
must be present for each retrieved object.  When keywords are
specified during an update, then those keywords fully replaces the
previous set of keywords.

If creationTime is not specified for a create action, then it must
default to the current time.  If updateTime is not specified for a
create or update action, then it must default to the current time.


*/

const ROLES = ['admin', 'author', 'commenter'];
const ROLES_SET = new Set(ROLES);
const DATE_RE = /^\d{4}\-\d\d\-\d\d(T[012]\d:[0-5]\d(:[0-6]\dZ)?)?$/;

const META = {

  users: [
    {
      name: 'id',
      friendlyName: 'user ID',
      required: [ 'create', 'update', 'remove' ],
    },
    {
      name: 'email', 
      friendlyName: 'user email',
      checkFn: v => v.split('@').length === 2,
      checkError: 'the user email fields must be of the form id@domain',
      required: [ 'create' ],
      forbidden: [ 'remove' ],
      doIndex: true,
    },
    {
      name: 'firstName', 
      friendlyName: 'user first name',
      required: [ 'create' ],
      forbidden: [ 'remove' ],
      doIndex: true,
    },
    {
      name: 'lastName', 
      friendlyName: 'user last name',
      required: [ 'create' ],
      forbidden: [ 'remove' ],
      doIndex: true,
    },
    {
      name: 'roles', 
      friendlyName: 'user roles',
      checkFn:  v => v instanceof Array && v.length > 0 &&
	             v.every(e => ROLES_SET.has(e)),
      checkError:
        `the user roles field must be an array of ${ROLES.join(', ')}`,
      required: [ 'create' ],
      forbidden: [ 'find', 'remove' ],
    },
    {
      name: 'creationTime', 
      friendlyName: 'user creation time',
      checkFn: v => v.match(DATE_RE),
      checkError: `the user creation time must be a valid ISO-8601 date-time`,
      data: v => new Date(v),
      forbidden: [ 'update', 'remove' ],
      defaultFn: () => new Date(),
      rel: 'geq',
      doIndex: true,
    },
    {
      name: 'updateTime', 
      friendlyName: 'user update time',
      checkFn: v => v.match(DATE_RE),
      checkError: `the user update time must be a valid ISO-8601 date-time`,
      data: v => new Date(v),
      forbidden: [ 'find', 'remove' ],
      defaultFn: () => new Date(),
    },
  ],

  articles: [
    {
      name: 'id',
      friendlyName: 'article ID',
      required: [ 'update', 'remove' ],
      forbidden: [ 'create' ],
    },
    {
      name: 'title', 
      friendlyName: 'article title',
      required: [ 'create' ],
      forbidden: [ 'find', 'remove' ],
    },
    {
      name: 'content', 
      friendlyName: 'article content',
      required: [ 'create' ],
      forbidden: [ 'find', 'remove' ],
    },
    {
      name: 'authorId', 
      friendlyName: 'author ID',
      required: [ 'create' ],
      forbidden: [ 'update', 'remove' ],
      identifies: 'users',
      doIndex: true,
    },
    {
      name: 'creationTime', 
      friendlyName: 'article creation time',
      checkFn: v => v.match(DATE_RE),
      checkError: `the article creation time must be a valid ISO-8601 date-time`,
      data: v => new Date(v),
      forbidden: [ 'update', 'remove' ],
      defaultFn: () => new Date(),
      rel: 'geq',
      doIndex: true,
    },
    {
      name: 'updateTime', 
      friendlyName: 'article update time',
      checkFn: v => v.match(DATE_RE),
      checkError: `the article update time must be a valid ISO-8601 date-time`,
      data: v => new Date(v),
      forbidden: [ 'find', 'remove' ],
      defaultFn: () => new Date(),
    },
    {
      name: 'keywords', 
      friendlyName: 'article keywords',
      checkFn: v => v instanceof Array && v.length > 0,
      checkError: `article keywords must be a non-empty array`,
      required: [ 'create' ], //must be non-empty
      forbidden: [ 'remove' ], 
      rel: 'array_eq',
      doIndex: true,
    },
  ],
  
  comments: [
    {
      name: 'id',
      friendlyName: 'comment ID',
      required: [ 'update', 'remove' ],
      forbidden: [ 'create' ],
    },
    {
      name: 'content', 
      friendlyName: 'comment content',
      required: [ 'create' ],
      forbidden: [ 'find', 'remove' ], //includes find implicitly
    },
    {
      name: 'articleId', 
      friendlyName: 'comment article ID',
      required: [ 'create' ],
      forbidden: [ 'update', 'remove' ],
      identifies: 'articles',
      doIndex: true,
    },
    {
      name: 'commenterId', 
      friendlyName: 'commenter ID',
      required: [ 'create' ],
      forbidden: [ 'update', 'remove' ],
      identifies: 'users',
      doIndex: true,
    },
    {
      name: 'creationTime', 
      friendlyName: 'comment creation time',
      checkFn: v => v.match(DATE_RE),
      checkError:
        `the comment creation time must be a valid ISO-8601 date-time`,
      data: v => new Date(v),
      forbidden: [ 'update', 'remove' ],
      defaultFn: () => new Date(),
      rel: 'geq',
      doIndex: true,
    },
    {
      name: 'updateTime', 
      friendlyName: 'comment update time',
      checkFn: v => v.match(DATE_RE),
      checkError: `the comment update time must be a valid ISO-8601 date-time`,
      data: v => new Date(v),
      forbidden: [ 'find', 'remove' ],
      defaultFn: () => new Date(),
    },
  ],
  
};

export default META;

