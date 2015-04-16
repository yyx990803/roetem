var fs = require('fs')
var path = require('path')
var browserify = require('browserify')
var watchify = require('watchify')
var vueify = require('vueify')

module.exports = function buildClient (app, cb) {
  console.log('building client assets...')
  var cwd = process.cwd()

  // check client entry file
  var clientEntry = path.resolve(cwd, 'client/main.js')
  if (!fs.existsSync(clientEntry)) {
    console.log('Cannot locate client entry file: ' + clientEntry)
    return cb()
  }

  // create public dir if doesn't exist
  var pubDir = cwd + '/public'
  if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir)

  var indexPath = pubDir + '/index.html'
  if (!fs.existsSync(indexPath)) {
    var index = fs.readFileSync(__dirname + '/../client/index.html')
    fs.writeFileSync(indexPath, index)
  }

  // build with browserify + vueify
  var b = browserify()
  b.add(clientEntry)
  b.transform(vueify)

  // first bundle
  var w = watchify(b)
  w.bundle(function (err, buf) {
    bundleCb(err, buf)
    cb()
  })

  // watch it
  w.on('update', function () {
    console.log('client updated, rebuilding...')
    w.bundle(bundleCb)
  })

  function bundleCb (err, buf) {
    if (err) {
      console.log(err.toString())
    } else {
      fs.writeFileSync(cwd + '/public/build.js', buf)
      console.log('done.')
      app.emit('client-reload')
    }
  }
}