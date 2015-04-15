var fs = require('fs')
var path = require('path')
var r = require('rethinkdb')
var express = require('express')
var http = require('http')
var sio = require('socket.io')
var browserify = require('browserify')
var watchify = require('watchify')
var vueify = require('vueify')
var Emitter = require('events').EventEmitter

function App (opts) {
  Emitter.call(this)
  this._opts = opts || {}
  this._buildClient()
}

var p = App.prototype = Object.create(Emitter.prototype)

p._buildClient = function () {
  console.log('building client assets...')
  var cwd = process.cwd()

  // create .rev dir and public dir
  var revDir = cwd + '/.rev'
  var pubDir = cwd + '/public'
  if (!fs.existsSync(revDir)) fs.mkdirSync(revDir)
  if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir)

  // link build assets into .rev
  ;[
    [__dirname + '/client/index.html', 'index.html'],
    [__dirname + '/client/entry.js', 'entry.js'],
    [__dirname + '/node_modules', 'node_modules'],
    [cwd + '/client', 'client']
  ].forEach(function (pair) {
    var src = pair[0]
    var dest = revDir + '/' + pair[1]
    if (!fs.existsSync(dest)) {
      fs.symlinkSync(src, dest)
    }
  })

  // build with browserify + vueify
  var b = browserify()
  b.add(revDir + '/entry.js')
  b.transform(vueify)

  // watch it
  var w = watchify(b)
  w.on('update', function () {
    console.log('client updated, rebuilding...')
    w.bundle(bundleCb)
  })

  // first bundle
  var self = this
  w.bundle(function (err, buf) {
    bundleCb(err, buf)
    self._initDb()
  })

  function bundleCb (err, buf) {
    if (err) {
      console.log(err.toString())
    } else {
      fs.writeFileSync(cwd + '/public/build.js', buf)
      console.log('done.')
      self.emit('client-reload')
    }
  }
}

p._initDb = function () {
  console.log('connecting to rethinkdb...')
  var opts = this._opts
  this.dbConnection = null
  var self = this
  r.connect(
    {
      host: opts.dbHost || 'localhost',
      port: opts.dbPort || 28015
    }, 
    function (err, conn) {
      if (err) throw err
      self.dbConnection = conn
      var dbName = opts.name || 'rev_app'
      r.dbCreate(dbName).run(conn, function (err) {
        if (err && !err.msg.match(/already exists/)) {
          throw err
        }
        self.db = r.db(dbName)
        self._initApp()
      })
    }
  )
}

p._initApp = function () {
  console.log('initializing app...')

  var self = this
  var db = this.db
  var app = this._app = express()
  var server = this._server = new http.Server(app)
  var io = this._io = sio(server)

  // realtime stuff
  io.on('connection', function (socket) {

    self.on('client-reload', reload)
    function reload () {
      socket.emit('reload')
    }

    socket.on('subscribe', function (query) {
      
    })

    socket.on('unsubscribe', function (query) {
      
    })

    socket.on('disconnect', function () {
      self.removeListener('client-reload', reload)
    })

  })

  var appDir = process.cwd()

  app.use(express.static('public'))

  app.get('/', function (req, res) {
    res.sendFile(appDir + '/.rev/index.html')
  })

  var port = this._opts.port || 8000
  server.listen(port, function () {
    console.log('app running on port ' + port)
    self.emit('ready')
  })
}

module.exports = function (opts) {
  return new App(opts)
}