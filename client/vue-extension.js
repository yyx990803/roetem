var db = require('./db')

module.exports = function (Vue) {
  var p = Vue.prototype
  var init = p._init

  p._init = function (opts) {
    init.call(this, opts)
    this._syncDict = {}
    if (opts.queries) {
      for (var key in opts.queries) {
        this.$sync(key, opts.queries[key])
      }
    }
  }

  p.$sync = function (key, fn) {
    var self = this
    this.$unsync(key)
    this._syncDict[key] = db.trackQuery(fn, function (e) {
      var arr = self.$get(key)
      switch (e.type) {
        case 'insert':
          arr.push(e.data.new_val)
          break
        case 'delete':
          var i = find(arr, e.data.old_val.id)
          if (i > -1) arr.splice(i, 1)
          break
        case 'update':
          var i = find(arr, e.data.old_val.id)
          if (i > -1) arr.$set(i, e.data.new_val)
          break
        default:
          self.$set(key, e.data || [])
          break
      }
    })
  }

  p.$unsync = function (key) {
    if (this._syncDict[key]) {
      this._syncDict[key].stop()
    }
  }
}

function find (arr, id) {
  for (var i = 0, l = arr.length; i < l; i++) {
    if (arr[i].id === id) return i
  }
  return -1
}