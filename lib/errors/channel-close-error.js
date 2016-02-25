var util = require('util')

var clone = require('101/clone')

module.exports = ChannelCloseError

function ChannelCloseError (message, data) {
  this.message = message
  this.name = 'ChannelCloseError'
  this.type = 'ChannelCloseError'
  this.data = clone(data)
  Error.captureStackTrace(this, this.constructor)
}

util.inherits(ChannelCloseError, Error)
