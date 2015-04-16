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

  var dbConn = app.dbConnection
  var openChangeFeeds = {}

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
    var subscriptions = {}

    // new subscription
    socket.on('subscribe', function onSubscribe (queryString) {

      // TODO: only allow read queries can be executed
      // and add pub/sub restrictions

      if (subscriptions[queryString]) {
        // already subscribed
        subscriptions[queryString]++
        return
      }
      console.log('new subscription for ' + queryString)
      subscriptions[queryString] = 1

      var query = buildQuery(queryString)

      query.run(dbConn, function onInitialResult (err, cursor) {
        if (err) {
          return handleSubscriptionError(err)
        }
        cursor.toArray(function (err, res) {
          if (err) {
            return handleSubscriptionError(err)
          }
          socket.emit('subscription-confirmed', {
            id: queryString,
            data: res
          })
          observeChanges()
        })
      })

      function observeChanges () {
        // setup change feed subscription
        var feed = openChangeFeeds[queryString]
        if (feed) {
          feed.sockets.push(socket)
        } else {
          feed = openChangeFeeds[queryString] = {
            cursor: null,
            sockets: [socket]
          }
          console.log('opening change feed for ' + queryString)

          query.changes().run(dbConn, function onChangeFeedCreate (err, cursor) {
            if (err) {
              return handleSubscriptionError(err)
            }
            // socket closed before change cursor is setup
            if (feed.cancelled) {
              cursor.close()
              return
            }
            feed.cursor = cursor
            cursor.each(function (err, change) {
              if (err) {
                return handleSubscriptionError(err)
              }
              var type = change.new_val
                ? change.old_val
                  ? 'update'
                  : 'insert'
                : 'delete'
              feed.sockets.forEach(function (s) {
                s.emit('subscription-updated', {
                  id: queryString,
                  type: type,
                  data: change
                })
              })
            })
          })
        }
      }

      function handleSubscriptionError (err) {
        console.log('subscription error: ' + err.msg)
        socket.emit('subscription-failed', {
          id: queryString,
          msg: err.msg
        })
      }
    })

    socket.on('unsubscribe', function onUnsubscribe (queryString) {
      subscriptions[queryString]--
      if (!subscriptions[queryString]) {
        removeSocketFromFeed(queryString, socket)
      }
    })

    socket.once('disconnect', function onDisconnect () {
      app.removeListener('client-reload', reload)
      for (var queryString in subscriptions) {
        removeSocketFromFeed(queryString, socket)
      }
    })

    socket.on('error', function (err) {
      console.log('Socket error: ')
      console.log(err)
    })

    function removeSocketFromFeed (queryString, socket) {
      var feed = openChangeFeeds[queryString]
      if (feed) {
        feed.sockets.splice(feed.sockets.indexOf(socket), 1)
        if (!feed.sockets.length) {
          openChangeFeeds[queryString] = null
          if (feed.cursor) {
            console.log('closing change feed for ' + queryString)
            feed.cursor.close()
          } else {
            // in the rare case if a socket is closed before
            // the change feed is setup, we still need to close
            // the cursor.
            feed.cancelled = true
          }
        }
      }
    }
  }

}