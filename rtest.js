var r = require('rethinkdb')
var util = require('util')

console.log(util.inspect(r.table('users').build(), false, null))