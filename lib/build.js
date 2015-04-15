var fs = require('fs')
var browserify = require('browserify')
var watchify = require('watchify')
var vueify = require('vueify')

module.exports = function (app, cb) {
  console.log('building client assets...')
  var cwd = process.cwd()

  // create .rev dir and public dir
  var revDir = cwd + '/.rev'
  var pubDir = cwd + '/public'
  if (!fs.existsSync(revDir)) fs.mkdirSync(revDir)
  if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir)

  var indexPath = pubDir + '/index.html'
  if (!fs.existsSync(indexPath)) {
    var index = fs.readFileSync(__dirname + '/../client/index.html')
    fs.writeFileSync(indexPath, index)
  }

  // link build assets into .rev
  ;[
    [__dirname + '/../client/entry.js', 'entry.js'],
    [__dirname + '/../node_modules', 'node_modules'],
    [cwd + '/client', 'client']
  ].forEach(function (pair) {
    var src = pair[0]
    var dest = revDir + '/' + pair[1]
    if (!fs.existsSync(dest)) {
      fs.symlinkSync(src, dest)
    }
  })

  // build with browserify + vueify
  var b = browserify()
  b.add(revDir + '/entry.js')
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