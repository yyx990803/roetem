var r = require('./ast')
var printQuery = require('./errors').printQuery
var socket = require('../socket')

var subCallbacks = {}

socket.on('subscription-confirmed', onData)
socket.on('subscription-updated', onData)

function onData (e) {
  var cbs = subCallbacks[e.id]
  if (cbs) {
    cbs.forEach(function (cb) {
      cb(e)
    })
  }
}

socket.on('subscription-failed', function (e) {
  console.warn('Subscription failed for query "' + e.id + '": ' + e.msg)
  // simply remove entire subscription callbacks list
  subCallbacks[e.id] = null
})

r.subscribe = function (query, cb) {
  var serialized = JSON.stringify(query.build())
  var queryString = printQuery(query)

  // create a list of callbacks for a subscription
  // if not there already
  var cbs = subCallbacks[queryString]
  if (!cbs) {
    subCallbacks[queryString] = [cb]
  } else {
    cbs.push(cb)
  }

  socket.emit('subscribe', {
    serialized: serialized,
    queryString: queryString
  })

  // return handle
  return {
    stop: function () {
      var cbs = subCallbacks[queryString]
      if (cbs) {
        var i = cbs.indexOf(cb)
        if (i > -1) {
          cbs.splice(i, 1)
          socket.emit('unsubscribe', queryString)
        }
      }
    }
  }
}

module.exports = r