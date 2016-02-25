var assert = require('assert')

var assertArgs = require('assert-args')
var castBuffer = require('cast-buffer')
var clone = require('101/clone')
var defaults = require('101/defaults')
var errToJSON = require('utils-error-to-json')
var first = require('first-event')
var maybe = require('call-me-maybe')
var set = require('101/set')
var throwNextTick = require('throw-next-tick')

var isConnection = require('./is-connection.js')
var ChannelCloseError = require('./errors/channel-close-error.js')
var QueueNotFoundError = require('./errors/queue-not-found-error.js')

var isQueue404ChannelError = function (err) {
  return err.code === 404 && /no queue/.test(err.message)
}

module.exports = reply

/**
 * Reply to an rpc request, publish a message to replyTo queue
 * Creates a channel and replies to the message using `properties.replyTo` and `properties.correlationId`.
 * @param  {AmqplibConnection} amqplib connection on which to create channel and reply on
 * @param  {Object} message incoming message on channel
 * @param  {Buffer|Object|Array|String} content message content
 * @param  {Object} [opts] sendToQueue options
 * @param  {Function} [cb] optional callback
 * @return {Promise}  returns a promise, only if using promise api
 */
function reply (connection, message, content, opts, cb) {
  var args = assertArgs(arguments, {
    'connection': isConnection,
    'message': 'object',
    'content': ['object', 'array', 'string', 'number', Buffer],
    '[opts]': 'object',
    '[cb]': 'function'
  })
  defaults(args, {
    opts: {}
  })

  var replyTo = message.properties.replyTo
  var correlationId = message.properties.correlationId
  assert(replyTo, "reply() cannot reply to a message without 'replyTo'")
  assert(correlationId, "reply() cannot reply to a message without 'correlationId'")

  // cast content to a buffer
  connection = args.connection
  content = castBuffer(args.content)
  opts = args.opts
  cb = args.cb
  // set correlation id for the reply message
  opts.correlationId = correlationId

  return connection.createChannel()
    .then(function (channel) {
      var errData = {
        queue: replyTo,
        correlationId: correlationId,
        message: message,
        content: args.content, // original content, not buffer
        opts: opts
      }
      var channelEvents = first(channel, ['error', 'close'])
      var channelEventsCancel = channelEvents.cancel
      channelEvents = channelEvents
        .catch(function (err) {
          // channel 'error' event, checkQueue error can end up here
          // no need to close channel; should be closed
          if (isQueue404ChannelError(err)) {
            throw new QueueNotFoundError('"replyTo" queue not found', set(errData, 'err', errToJSON(err)))
          } else {
            // error events are thrown if they do not have handlers
            // channel errors should be uncaught exceptions and crash the process
            err.data = clone(errData)
            throwNextTick(err)
          }
        })
        .then(function () {
          // channel 'close' event
          throw new ChannelCloseError('rpc channel closed before publishing the response message', errData)
        })
      var replyPromise = channel.checkQueue(replyTo)
        .then(function () {
          channelEventsCancel()
          var ret = channel.sendToQueue(replyTo, content, opts)
          return channel.close().then(function () {
            return ret // boolean
          })
        })
        .catch(function (err) {
          // note: the only error I know of is 404 queue which will result in channel 'error' event
          //       it's possible this code will never be hit
          channelEventsCancel()
          channel.sendToQueue(replyTo, content, opts)
          return channel.close().then(function () {
            // checkQueue error
            if (isQueue404ChannelError(err)) {
              throw new QueueNotFoundError('"replyTo" queue not found', set(errData, 'err', errToJSON(err)))
            } else {
              err.data = clone(errData)
              throw err // some unexpected error
            }
          })
        })
      // race
      var promise = Promise.race([
        channelEvents,
        replyPromise
      ])
      // callback or return promise
      return maybe(cb, promise)
    })
}
