var Vue = require('vue')
// extend Vue with some live update functionalities
require('roetem/client/vue-extension')(Vue)

// boot up interface
var indexOptions = require('./client/index.vue')
new Vue(indexOptions).$mount('#app')

// auto reload
var socket = require('roetem/client/socket')
socket.on('reload', function () {
  window.location.reload()
})