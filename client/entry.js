// This is the entry file for the app's client side bundle.
// It's symlinked into .roetem therefore we need to use
// node_modules require paths instead of relative paths.

var Vue = require('vue')
// extend Vue with some live update functionalities
require('roetem/client/vue-extension')(Vue)

// boot up interface
var indexOptions = require('./client/index.vue')
window.app = new Vue(indexOptions).$mount('#app')

// auto reload
var socket = require('roetem/client/socket')
socket.on('reload', function () {
  window.location.reload()
})