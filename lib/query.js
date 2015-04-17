var termTypes = require('rethinkdb/proto-def').Term.TermType

function Query (opts) {
  this.queryString = opts.queryString
  this.parsed = JSON.parse(opts.serialized)
  this.tt = this.parsed[0]
}

function ChangeQuery (opts) {
  this.queryString = opts.queryString + '.changes()'
  this.parsed = [termTypes.CHANGES, [JSON.parse(opts.serialized)]]
  this.tt = termTypes.CHANGES
}

Query.prototype.build = ChangeQuery.prototype.build = function () {
  return this.parsed
}

// patch rethinkdb's errors so it can deal
// with our fake queries when trying to print errors

var errors = require('rethinkdb/errors')

exports.Query = Query
exports.ChangeQuery = ChangeQuery