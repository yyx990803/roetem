var express = require('express')
var http = require('http')
var sio = require('socket.io')

module.exports = function (app, cb) {
  console.log('initializing app...')

  var db = app.db
  var dbConn = app.dbConnection
  var expressApp = app.express = express()
  var server = app.server = new http.Server(expressApp)
  var io = app.io = sio(server)

  // app-level hash of subscriptions, shared across multiple
  // connections
  var subscriptions = {}

  function unsubQuery (id, socket) {
    var sub = subscriptions[id]
    if (sub) {
      sub.sockets.splice(sub.sockets.indexOf(socket), 1)
      if (!sub.sockets.length) {
        subscriptions[id] = null
        if (sub.cursor) {
          console.log('closing change feed for ' + id)
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
    console.log('new connection')

    // signal client for reloads
    app.on('client-reload', reload)
    function reload () {
      socket.emit('reload')
    }

    // subscription identifiers for this connection
    var connectionSubIds = []

    // new subscription
    socket.on('subscribe', function (query) {
      console.log('new subscription for ' + query.id)
      connectionSubIds.push(query.id)
      var table = db.table(query.tableName)

      // send initial full data
      table.run(dbConn, function (err, cursor) {
        if (err) return cb(err)
        cursor.toArray(function (err, res) {
          if (err) return cb(err)
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
        console.log('opening change feed for ' + query.id)
        table.changes().run(dbConn, function (err, cursor) {
          if (err) return cb(err)
          // socket closed before change cursor is setup
          if (sub.cancelled) {
            cursor.close()
            return
          }
          sub.cursor = cursor
          cursor.each(function (err, change) {
            if (err) return cb(err)
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
      app.removeListener('client-reload', reload)
      connectionSubIds.forEach(function (id) {
        unsubQuery(id, socket)
      })
    })

  })
  
  // setup the express app and get things running
  var appDir = process.cwd()
  expressApp.use(express.static('public'))
  expressApp.get('/', function (req, res) {
    res.sendFile(appDir + '/public/index.html')
  })

  var port = app._opts.port || 8000
  server.listen(port, function () {
    console.log('app running on port ' + port)
    cb()
  })
}