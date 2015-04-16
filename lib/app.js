var express = require('express')
var http = require('http')
var sio = require('socket.io')
var connectionHandlerFactory = require('./connection')

module.exports = function initApp (app, cb) {
  console.log('initializing app...')

  var expressApp = app.express = express()
  var server = app.server = new http.Server(expressApp)
  var io = app.io = sio(server)

  // realtime stuff
  io.on('connection', connectionHandlerFactory(app, cb))
  
  // setup the express app and get things running
  var appDir = process.cwd()
  expressApp.use(express.static('public'))
  expressApp.get('/', function (req, res) {
    res.sendFile(appDir + '/public/index.html')
  })

  var port = app._opts.port || 8000
  server.listen(port, function () {
    console.log('app running on port ' + port)
    cb()
  })
}