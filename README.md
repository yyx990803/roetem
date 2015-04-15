# Roetem

> Meteor-like experiment using Vue + RethinkDB

### Example

```
.
├── app.js
└── client
    └── index.vue
```

``` js
// app.js
require('roetem')()
```

``` html
// client/index.vue
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
    items: function () {
      return db.table('items')
    }
  }
}
</script>
```

``` bash
# start rethinkdb first
node app.js

> building client assets...
> done.
> connecting to rethinkdb...
> initializing app...
> app running on port 8000
```