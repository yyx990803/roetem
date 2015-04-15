var r = require('rethinkdb')

module.exports = function (app, cb) {
  console.log('connecting to rethinkdb...')

  var opts = app._opts
  app.dbConnection = null
  r.connect(
    {
      host: opts.dbHost || 'localhost',
      port: opts.dbPort || 28015
    }, 
    function (err, conn) {
      if (err) {
        return cb(err)
      }
      app.dbConnection = conn
      var dbName = opts.name || 'rev_app'
      r.dbCreate(dbName).run(conn, function (err) {
        if (err && !err.msg.match(/already exists/)) {
          return cb(err)
        }
        app.db = r.db(dbName)
        cb()
      })
    }
  )
}