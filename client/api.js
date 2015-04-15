var clientDb = require('./db')
exports.db = new clientDb()
exports.socket = io.connect(window.location.host)