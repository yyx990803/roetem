var api = require('rev/client/api')

api.socket.on('reload', function () {
  window.location.reload()
})

// extend Vue with some live update functionalities
var Vue = require('vue')
var p = Vue.prototype
var init = p._init

p._init = function (opts) {
  init.call(this, opts)
  this._syncDict = {}
  if (opts.sync) {
    for (var key in opts.sync) {
      this.$sync(key, opts.sync[key])
    }
  }
}

p.$sync = function (key, fn) {
  var self = this
  this.$unsync(key)
  this._syncDict[key] = api.db.trackQuery(fn, function (val) {
    self.$set(key, val)
  })
}

p.$unsync = function (key) {
  if (this._syncDict[key]) {
    this._syncDict[key].stop()
  }
}

// boot up interface
var indexOptions = require('./client/index.vue')
new Vue(indexOptions).$mount('#app')