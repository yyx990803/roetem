var api = require('./api')

function db () {
  console.log('client db instance created!')
}

var p = db.prototype

p.trackQuery = function (queryFn, cb) {

  cb([{text:'hi'}])

  return {
    stop: function () {
      
    }
  }
}

module.exports = db