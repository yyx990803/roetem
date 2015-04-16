var r = require('./ast')
var serialize = require('./errors').printQuery
var api = require('../api')

r.subscribe = function (query, cb) {
  var socket = api.socket
  var queryString = serialize(query)
  socket.emit('subscribe', queryString)
  socket.once('subscription-confirmed', handler)
  socket.on('subscription-updated', handler)

  function handler (e) {
    if (e.id === queryString) {
      cb(e)
    }
  }

  var handle = {
    stop: function () {
      socket.emit('unsubscribe', queryString)
      socket.removeListener('subscription-updated', handler)
    }
  }

  socket.once('subscription-failed', function (e) {
    if (e.id === queryString) {
      console.warn('Subscription failed: ' + e.msg)
      handle.stop()
    }
  })

  // return handle
  return handle
}

module.exports = r