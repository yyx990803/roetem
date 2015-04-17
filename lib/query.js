var termTypes = require('rethinkdb/proto-def').Term.TermType

function Query (opts) {
  this.fake = true
  this.queryString = opts.queryString
  this.parsed = JSON.parse(opts.serialized)
  this.tt = this.parsed[0]
}

function ChangeQuery (opts) {
  this.fake = true
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

function CompatibleError (msg, term, frames) {
  this.name = this.constructor.name;
  this.msg = msg;
  this.frames = frames.slice(0);
  this.message = "" + msg + "in:\n" + term.queryString;
  if (Error.captureStackTrace != null) {
    Error.captureStackTrace(this, this);
  }
}

;[
  'RqlRuntimeError',
  'RqlCompileError',
  'RqlClientError'
].forEach(function (type) {
  var OriginalError = errors[type]
  errors[type] = function (msg, term, frames) {
    if (term.fake) {
      return new CompatibleError(msg, term, frames)
    } else {
      return new OriginalError(msg, term, frames)
    }
  }
})

exports.Query = Query
exports.ChangeQuery = ChangeQuery