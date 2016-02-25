var util = require('util')

var clone = require('101/clone')

module.exports = QueueNotFoundError

function QueueNotFoundError (message, data) {
  this.message = message
  this.name = 'QueueNotFoundError'
  this.type = 'QueueNotFoundError'
  this.data = clone(data)
  Error.captureStackTrace(this, this.constructor)
}

util.inherits(QueueNotFoundError, Error)
