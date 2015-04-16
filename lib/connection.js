/**
 * This module is a factory function that returns a
 * connection handler function for a given app.
 *
 * @param {RoetemApp} app
 * @param {Function} cb - callback for the app init function
 */
module.exports = function connectHandlerFactory (app, cb) {

  var db = app.db
  var dbConn = app.dbConnection
  var subscriptions = app.subscriptions = {}

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

  /**
   * Connection handler
   * 1 closure for each connection.
   */
  return function onConnectHandler (socket) {
    console.log('new connection')

    // signal client for reloads
    app.on('client-reload', reload)
    function reload () {
      socket.emit('reload')
    }

    // subscription identifiers for this connection
    var connectionSubIds = []

    // new subscription
    socket.on('subscribe', function onSubscribe (query) {
      console.log('new subscription for ' + query.id)
      connectionSubIds.push(query.id)
      var table = db.table(query.tableName)

      // send initial full data
      table.run(dbConn, function onTableFetch (err, cursor) {
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
        table.changes().run(dbConn, function onChangeFeedCreate (err, cursor) {
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

    socket.on('unsubscribe', function onUnsubscribe (query) {
      connectionSubIds.splice(connectionSubIds.indexOf(query), 1)
      unsubQuery(query.id, socket)
    })

    socket.once('disconnect', function onDisconnect () {
      app.removeListener('client-reload', reload)
      connectionSubIds.forEach(function (id) {
        unsubQuery(id, socket)
      })
    })
  }

}