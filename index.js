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
  var dbConn = this.dbConnection
  var app = this._app = express()
  var server = this._server = new http.Server(app)
  var io = this._io = sio(server)

  // global hash of subscriptions, shared across multiple
  // connections
  var subscriptions = {}

  function unsubQuery (id, socket) {
    var sub = subscriptions[id]
    if (sub) {
      sub.sockets.splice(sub.sockets.indexOf(socket), 1)
      if (!sub.sockets.length) {
        subscriptions[id] = null
        if (sub.cursor) {
          sub.cursor.close()
        } else {
          // in the rare case if a socket is closed before
          // the subscription is setup, we still need to close
          // the cursor.
          sub.cancelled = true
        }
      }
    }
  }

  // realtime stuff
  io.on('connection', function (socket) {

    self.on('client-reload', reload)
    function reload () {
      socket.emit('reload')
    }

    // subscription identifiers for this connection
    var connectionSubIds = []

    socket.on('subscribe', function (query) {
      connectionSubIds.push(query.id)
      var table = db.table(query.tableName)

      // send initial full data
      table.run(dbConn, function (err, cursor) {
        if (err) throw err
        cursor.toArray(function (err, res) {
          if (err) throw err
          socket.emit('subscription-confirmed', {
            id: query.id,
            data: res
          })
        })
      })

      // setup change feed subscription
      var sub = subscriptions[query.id]
      if (sub) {
        sub.sockets.push(socket)
      } else {
        sub = subscriptions[query.id] = {
          cursor: null,
          sockets: [socket]
        }
        table.changes().run(dbConn, function (err, cursor) {
          if (err) throw err
          // socket closed before change cursor is setup
          if (sub.cancelled) {
            cursor.close()
            return
          }
          sub.cursor = cursor
          cursor.each(function (err, change) {
            if (err) throw err
            var type = change.new_val
              ? change.old_val
                ? 'update'
                : 'insert'
              : 'delete'
            sub.sockets.forEach(function (s) {
              s.emit('subscription-updated', {
                id: query.id,
                type: type,
                data: change
              })
            })
          })
        })
      }
    })

    socket.on('unsubscribe', function (query) {
      connectionSubIds.splice(connectionSubIds.indexOf(query), 1)
      unsubQuery(query.id, socket)
    })

    socket.once('disconnect', function () {
      self.removeListener('client-reload', reload)
      connectionSubIds.forEach(function (id) {
        unsubQuery(id, socket)
      })
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