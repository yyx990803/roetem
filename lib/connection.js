var r = require('rethinkdb')
var Query = require('./query').Query
var ChangeQuery = require('./query').ChangeQuery
var queryWhitelist = require('./query-whitelist')

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

    /**
     * New subscription handler.
     *
     * @param {Object} queryInfo
     *                 - queryString e.g. "r.table('test')"
     *                 - serialized  e.g. "[15, ['test']]"
     */
    socket.on('subscribe', function onSubscribe (queryInfo) {

      var queryString = queryInfo.queryString
      // construct a fake query object that can be used
      // in connection._start
      var query = new Query(queryInfo)

      // book-keeping
      if (subscriptions[queryString]) {
        // already subscribed
        subscriptions[queryString]++
        return
      }
      console.log('new subscription for ' + queryString)
      subscriptions[queryString] = 1

      // only allow read queries
      if (!queryWhitelist[query.tt]) {
        var msg = 'disallowed query: ' + queryString
        handleSubscriptionError({ msg: msg })
        return
      }

      // inital fetch
      dbConn._start(query, function onInitialResult (err, cursor) {
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
      }, {})

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

          var changeQuery = new ChangeQuery(queryInfo)
          dbConn._start(changeQuery, function onChangeFeedCreate (err, cursor) {
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
          }, {})
        }
      }

      function handleSubscriptionError (err) {
        console.log('subscription error: ' + err.msg)
        unsubscribe()
        socket.emit('subscription-failed', {
          id: queryString,
          msg: err.msg
        })
      }
    })

    socket.on('unsubscribe', unsubscribe)

    function unsubscribe (queryString) {
      if (subscriptions[queryString]) {
        subscriptions[queryString]--
        if (!subscriptions[queryString]) { 
          removeSocketFromFeed(queryString, socket)
        }
      }
    }

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
        var i = feed.sockets.indexOf(socket)
        if (i > -1) {
          feed.sockets.splice(i, 1)
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

}