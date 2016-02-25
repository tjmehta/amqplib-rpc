var assert = require('assert')

var assertArgs = require('assert-args')

var checkQueue = require('./check-queue.js')
var isConnection = require('./is-connection.js')

module.exports = checkReplyQueue

/**
 * create a channel, check if replyTo queue exists, and close the channel
 * @param  {AmqpblibConnection}   connection amqplib rabbitmq connection
 * @param  {Object}   message    request queue message
 * @param  {Function} [cb]       not required if using promises
 * @return {Promise}  if using promises
 */
function checkReplyQueue (connection, message, cb) {
  assertArgs(arguments, {
    'connection': isConnection,
    'message': 'object',
    '[cb]': 'function'
  })
  var replyTo = message.properties.replyTo
  assert(replyTo, "'replyTo' is required")
  return checkQueue(connection, replyTo, cb)
}
