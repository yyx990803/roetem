# Roetem

> Meteor-like experiment using Vue + RethinkDB

### Example

```
.
├── app.js
└── client
    └── main.js
    └── components
        └── index.vue
```

``` js
// app.js
require('roetem').createApp({
  // default options
  // dbHost: 'localhost',
  // dbPort: 25108
})
```

``` js
// client/main.js
var rootComponent = require('./components/index.vue')
require('roetem').render(rootComponent, '#app')
```

``` html
// client/components/index.vue
<template>
  <h1>{{msg}}</h1>
  <h2>A list</h2>
  <ul>
    <li v-repeat="items" track-by="id">{{text}}</li>
  </ul>
</template>

<script>
var db = require('roetem').db

module.exports = {
  data: {
    msg: 'Hello Roetem!'
  },
  queries: {
    // realtime reactive RQL queries
    items: db.table('items').filter({text: 'lol'})
  }
}
</script>
```

``` bash
$ rethinkdb & node app.js

> building client assets...
> done.
> connecting to rethinkdb...
> initializing app...
> app running on port 8000
```