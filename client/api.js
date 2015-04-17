// extend Vue with some live update functionalities
var Vue = exports.Vue = require('vue')
require('./vue-extension')(Vue)

// db
exports.db = require('./db')

// socket
var socket = exports.socket = require('./socket')
socket.on('reload', function () {
  window.location.reload()
})

exports.render = function (component, el) {
  if (typeof component === 'function') {
    return new component({ el: el })
  } else {
    return new Vue(component).$mount(el)
  }
}