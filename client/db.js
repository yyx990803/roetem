var socket = require('./socket')
var Query = require('./query')

function db () {
  console.log('client db instance created!')
}

var p = db.prototype

p.table = function (tableName) {
  return new Query(tableName)
}

p.trackQuery = function (queryFn, cb) {
  var query = queryFn()
  query.id = JSON.stringify(query)
  socket.emit('subscribe', query)
  socket.once('subscription-confirmed', handler)
  socket.on('subscription-updated', handler)

  function handler (e) {
    if (e.id === query.id) {
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

module.exports = new db()