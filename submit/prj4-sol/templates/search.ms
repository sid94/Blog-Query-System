<!DOCTYPE html>
<html>
  <head>
    <title>User Search</title>
    <link rel="stylesheet" href="/css/style.css">
  </head>
  <body>
    <h1>User Search</h1>
    {{#errors}}
        <p class="error">{{.}}</p>
    {{/errors}}
    <p>
	 Please fill in one or more of the following fields
    </p>
    <form method="GET" action="/search/users">
	{{#fields}}
	  {{#isSearch}}
	     <label for="{{id}}">{{label}}</label>
	     <div>
      	    <input name="{{name}}" id="{{id}}" value="{{value}}">
      	    {{#errorMessage}}
                <div class="error">{{errorMessage}}</div>
            {{/errorMessage}}
         </div>

	  {{/isSearch}}
	 {{/fields}}

      &nbsp;
      <input name="submit" type="submit" value="search" class="control">
    </form>
    {{>footer}}
  </body>
</html>
