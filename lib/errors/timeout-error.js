var util = require('util')

var clone = require('101/clone')

module.exports = TimeoutError

function TimeoutError (message, data) {
  this.message = message
  this.name = 'TimeoutError'
  this.type = 'TimeoutError'
  this.data = clone(data)
  Error.captureStackTrace(this, this.constructor)
}

util.inherits(TimeoutError, Error)
