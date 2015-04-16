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

  // return handle
  return {
    stop: function () {
      socket.emit('unsubscribe', query)
      socket.removeListener('subscription-updated', handler)
    }
  }
}

module.exports = r