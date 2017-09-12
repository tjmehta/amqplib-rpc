var assert = require('assert')

var assertArgs = require('assert-args')
var debug = require('debug')('amqplib-rpc:reply')
var castBuffer = require('cast-buffer')
var defaults = require('101/defaults')
var exists = require('101/exists')
var put = require('101/put')

var isChannel = function (channel) {
  if (!channel || !channel.sendToQueue) {
    throw TypeError('"channel" must be an amqplib channel: http://www.squaremobius.net/amqp.node/channel_api.html#model_createChannel')
  }
}

module.exports = reply

/**
 * Reply to an rpc request, publish a message to replyTo queue
 * Replies to a message using `properties.replyTo` and `properties.correlationId`.
 * @param  {AmqplibChannel} channel on which the message was recieved
 * @param  {Object} message incoming message on channel
 * @param  {Buffer|Object|Array|String} content message content
 * @param  {Object} opts publish options
 * @return {Boolean} replyWriteSuccess
 */
function reply (channel, message, content, opts) {
  const replyTo = message.properties.replyTo
  const correlationId = message.properties.correlationId

  assert(replyTo, "reply() cannot reply to a message without 'replyTo'")

  const args = assertArgs(arguments, {
    'channel': isChannel,
    'message': 'object',
    'content': ['object', 'array', 'string', 'number', Buffer],
    '[opts]': 'object'
  })
  defaults(args, {
    opts: {}
  })
  // cast content to a buffer
  channel = args.channel
  content = castBuffer(args.content)
  opts = args.opts
  // set correlation id for the reply message
  var _opts = exists(correlationId)
    ? put(opts, 'correlationId', correlationId)
    : opts
  debug('Reply send message:', replyTo, content, _opts)
  return channel.sendToQueue(replyTo, content, _opts)
}
