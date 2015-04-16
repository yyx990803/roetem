var r = require('rethinkdb')

/**
 * Build a RQL Term object from the query string simply
 * by eval'ing it in a function.
 *
 * @param {String} queryString
 * @return {RqlTerm}
 */
function buildQuery (queryString) {
  return new Function('r', 'return ' + queryString)(r)
}

/**
 * This module is a factory function that returns a
 * connection handler function for a given app.
 *
 * @param {RoetemApp} app
 * @return {Function} connectHandler
 */
module.exports = function connectHandlerFactory (app) {

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
   * One closure for each connection.
   */
  return function onConnectHandler (socket) {
    console.log('new connection')

    // signal client for reloads
    app.on('client-reload', reload)
    function reload () {
      socket.emit('reload')
    }

    // subscription identifiers for this connection
    var connectionQueries = []

    // new subscription
    socket.on('subscribe', function onSubscribe (queryString) {
      console.log('new subscription for ' + queryString)
      connectionQueries.push(queryString)

      var query = buildQuery(queryString)

      query.run(dbConn, function onInitialResult (err, cursor) {
        if (err) throw err
        cursor.toArray(function (err, res) {
          if (err) throw err
          socket.emit('subscription-confirmed', {
            id: queryString,
            data: res
          })
        })
      })

      // setup change feed subscription
      var sub = subscriptions[queryString]
      if (sub) {
        sub.sockets.push(socket)
      } else {
        sub = subscriptions[queryString] = {
          cursor: null,
          sockets: [socket]
        }
        console.log('opening change feed for ' + queryString)

        query.changes().run(dbConn, function onChangeFeedCreate (err, cursor) {
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
                id: queryString,
                type: type,
                data: change
              })
            })
          })
        })
      }
    })

    socket.on('unsubscribe', function onUnsubscribe (query) {
      connectionQueries.splice(connectionQueries.indexOf(query), 1)
      unsubQuery(queryString, socket)
    })

    socket.once('disconnect', function onDisconnect () {
      app.removeListener('client-reload', reload)
      connectionQueries.forEach(function (id) {
        unsubQuery(id, socket)
      })
    })

    socket.on('error', function (err) {
      console.log('Socket error: ')
      console.log(err)
    })
  }

}