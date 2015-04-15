var Emitter = require('events').EventEmitter
var async = require('async')
var buildClient = require('./lib/build')
var initDb = require('./lib/db')
var initApp = require('./lib/app')

function Rev (opts) {
  Emitter.call(this)
  this._opts = opts || {}
  var app = this
  async.series(
    [
      function (cb) { buildClient(app, cb) },
      function (cb) { initDb(app, cb) },
      function (cb) { initApp(app, cb) }
    ],
    function (err) {
      if (err) throw err
      app.emit('ready')
    }
  )
}

Rev.prototype = Object.create(Emitter.prototype)

module.exports = function (opts) {
  return new Rev(opts)
}