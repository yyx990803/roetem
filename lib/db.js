var r = require('rethinkdb')
var async = require('async')

module.exports = function initDb (app, cb) {
  console.log('connecting to rethinkdb...')

  var opts = app._opts
  app.dbConnection = null
  r.connect(
    {
      host: opts.dbHost || 'localhost',
      port: opts.dbPort || 28015
    }, 
    onConnect
  )

  function onConnect (err, conn) {
    if (err) return cb(err)

    app.dbConnection = conn
    var dbName = opts.dbName || 'roetem_app'
    r.dbCreate(dbName).run(conn, onCreateDb)

    function onCreateDb (err) {
      if (err && !err.msg.match(/already exists/)) {
        return cb(err)
      }
      app.db = r.db(dbName)
      if (opts.tables) {
        // create tables
        async.parallel(opts.tables.map(tableNameToCreateFn), cb)
      } else {
        cb()
      }
    }

    function tableNameToCreateFn (table) {
      return function tableCreateFn (cb) {
        app.db.tableCreate(table).run(conn, function onTableCreate (err) {
          if (err && !err.msg.match(/already exists/)) {
            cb(err)
          } else {
            cb()
          }
        })
      }
    }
  }

}