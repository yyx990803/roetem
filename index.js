var Emitter = require('events').EventEmitter
var async = require('async')
var buildClient = require('./lib/build')
var initDb = require('./lib/db')
var initApp = require('./lib/app')

function Roetem (opts) {
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

Roetem.prototype = Object.create(Emitter.prototype)

exports.createApp = function (opts) {
  return new Roetem(opts)
}