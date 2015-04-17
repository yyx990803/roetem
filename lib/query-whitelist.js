var t = require('rethinkdb/proto-def').Term.TermType

// a white list of queries that are allowed from the client-side.
// basically all read-only queries that can retrive documents.
var whitelist = [
  // select
  t.TABLE,
  t.GET,
  t.GET_ALL,
  t.BETWEEN,
  t.FILTER,
  // joins
  t.INNER_JOIN,
  t.OUTER_JOIN,
  t.EQ_JOIN,
  t.ZIP,
  // transformations
  t.MAP,
  t.WITH_FIELDS,
  t.CONCAT_MAP,
  t.ORDER_BY,
  t.SKIP,
  t.LIMIT,
  t.SLICE,
  t.NTH,
  t.OFFSETS_OF,
  t.IS_EMPTY,
  t.UNION,
  t.SAMPLE,
  // aggregations
  t.GROUP,
  t.UNGROUP,
  t.REDUCE,
  t.COUNT,
  t.SUM,
  t.AVG,
  t.MIN,
  t.MAX,
  t.DISTINCT,
  t.CONTAINS,
  // document manipulations
  t.PLUCK,
  t.WITHOUT,
  t.MERGE,
  t.APPEND,
  t.PREPEND,
  t.DIFFERENCE,
  t.SET_INSERT,
  t.SET_UNION,
  t.SET_DIFFERENCE,
  t.BRACKET,
  t.HAS_FIELDS
]

var whitelistHash = module.exports = {}
whitelist.forEach(function (term) {
  whitelistHash[term] = 1
})