var assertArgs = require('assert-args')
var maybe = require('call-me-maybe')
var castBuffer = require('cast-buffer')
var clone = require('101/clone')
var defaults = require('101/defaults')
var first = require('first-event')
var timeout = require('timeout-then')
var uuid = require('uuid')

var isConnection = require('./is-connection.js')
var TimeoutError = require('./errors/timeout-error.js')
var ChannelCloseError = require('./errors/channel-close-error.js')

/**
  * Make an rpc request, publish a message to an rpc queue
  * Creates a channel, queue, correlationId, and sets up `properties.replyTo` and `properties.correlationId`
  * @param  {AmqplibConnection}   connection     rabbitmq connection
  * @param  {String}   queue     name of rpc-queue to send the message to
  * @param  {Buffer}   content   message content
  * @param  {Object}   [opts]  sendToQueue options
  * @param  {Object}   [opts.timeout]  timeout options
  * @param  {Object}   [opts.sendOpts]  sendToQueue options
  * @param  {Object}   [opts.queueOpts] assertQueue options for replyTo queue, queueOpts.exclusive defaults to true
  * @param  {Object}   [opts.consumeOpts] consume options for replyTo queue, consumeOpts defaults to true
  * @param  {Function} [cb] optional, only for callback api
  * @return {Promise}  returns a promise, only if using promise api
  */
module.exports = request

function request (connection, queueName, content, opts, cb) {
  var args = assertArgs(arguments, {
    'connection': isConnection,
    'queueName': 'string',
    'content': ['object', 'array', 'string', 'number', Buffer],
    '[opts]': 'object',
    '[cb]': 'function'
  })
  defaults(args, {
    opts: {}
  })
  args.opts = clone(args.opts)
  assertArgs([
    args.opts.timeout,
    args.opts.sendOpts,
    args.opts.queueOpts,
    args.opts.consumeOpts
  ], {
    '[opts.timeout]': ['number'],
    '[opts.sendOpts]': 'object',
    '[opts.queueOpts]': 'object',
    '[opts.consumeOpts]': 'object'
  })
  defaults(args.opts, {
    sendOpts: {},
    queueOpts: {},
    consumeOpts: {}
  })
  queueName = args.queueName
  content = castBuffer(args.content)
  opts = args.opts
  cb = args.cb
  defaults(opts.queueOpts, { exclusive: true }) // default exclusive queue. scopes queue to the connection
  defaults(opts.consumeOpts, { noAck: true }) // default no ack required for replyTo

  var sendOpts = opts.sendOpts
  var queueOpts = opts.queueOpts
  var consumeOpts = opts.consumeOpts

  var promise = connection.createChannel()
    .then(function (channel) {
      var errData = {
        queue: queueName,
        content: args.content,
        opts: opts
      }
      // rpc correlation id
      var corrId = uuid()
      // channel exit promise
      var channelClose = first(channel, ['close'])
      var cancelChannelClose = channelClose.cancel
      channelClose = channelClose.then(function () {
        // channel 'close' event
        throw new ChannelCloseError('rpc channel closed before receiving the response message', errData)
      })
      // rpc response message promise
      var responsePromise = channel.assertQueue('', queueOpts)
        .then(function (replyQueue) {
          return new Promise(function (resolve, reject) {
            channel
              .consume(replyQueue.queue, messageHandler, consumeOpts)
              .catch(reject)
            function messageHandler (message) {
              if (message.properties.correlationId === corrId) {
                resolve(message)
              }
            }
          })
        })
        .catch(function (err) {
          // close channel if error occurs
          cancelChannelClose()
          return channel.close().then(function () {
            throw err
          })
        })
        .then(function (message) {
          // close channel after success
          cancelChannelClose()
          return channel.close().then(function () {
            return message
          })
        })
      // setup promise race
      var promises = [channelClose, responsePromise]
      // if timeout option exists, add timeout to race
      if (opts.timeout) {
        promises.push(
          timeout(opts.timeout)
            .then(function () {
              // close channel after timeout occurs
              cancelChannelClose()
              return channel.close()
            })
            .then(function () {
              // throw timeout error
              throw new TimeoutError('rpc timed out', {
                queue: queueName,
                content: args.content,
                opts: opts
              })
            })
        )
      }
      // send rpc request
      channel.sendToQueue(queueName, content, sendOpts)
      // race: channel-exit, response-message, and optionally timeout
      return Promise.race(promises)
    })
  // promise or callback
  return maybe(cb, promise)
}
