var assertArgs = require('assert-args')
var debug = require('debug')('amqplib-rpc:request')
var maybe = require('call-me-maybe')
var castBuffer = require('cast-buffer')
var clone = require('101/clone')
var defaults = require('101/defaults')
var first = require('first-event')
var put = require('101/put')
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

  debug('createChannel')
  var promise = connection.createChannel().then(function (channel) {
    var errData = {
      queue: queueName,
      content: args.content,
      opts: opts
    }
    var corrId = uuid()
    // channel close promise
    var channelCloseEventPromise = first(channel, ['close'])
    var cancel = channelCloseEventPromise.cancel // cache cancel
    var _replyQueue
    channelCloseEventPromise = channelCloseEventPromise.then(function () {
      // channel 'close' event recieved before response
      throw new ChannelCloseError('rpc channel closed before receiving the response message', errData)
    })
    channelCloseEventPromise.cancel = cancel // restore cancel
    debug('Assert queue and send request', corrId, queueOpts)
    var assertAndSendPromise = channel.assertQueue('', queueOpts).then(function (replyQueue) {
      debug('Assert queue and send request: success', corrId, replyQueue)
      _replyQueue = replyQueue
      // rpc correlation id
      // rpc response message promise
      var responsePromise = new Promise(function (resolve, reject) {
        debug('Consume reply queue:', corrId, replyQueue.queue)
        var messageHandler = function (message) {
          if (!message) {
            // queue deleted
            return
          }
          if (message.properties.correlationId === corrId) {
            debug('Reply queue received response message:', corrId, message)
            resolve(message)
          }
        }
        return channel
          .consume(replyQueue.queue, messageHandler, consumeOpts)
          .catch(reject)
      })
      // send rpc request
      var _sendOpts = put(sendOpts, {
        correlationId: corrId,
        replyTo: replyQueue.queue
      })
      debug('Send request message:', corrId, queueName, content, _sendOpts)
      channel.sendToQueue(queueName, content, _sendOpts)
      // return response promise
      return responsePromise
        .catch(function (err) {
          debug('Response error:', err.stack)
          throw err
        })
        .then(function (message) {
          debug('Response success:', message)
          return message
        })
    })
    // setup promise race
    var promises = [channelCloseEventPromise, assertAndSendPromise]
    // if timeout option exists, add timeout to race
    if (opts.timeout) {
      debug('Add timeout promise')
      promises.push(
        timeout(opts.timeout).then(function () {
          // throw timeout error
          throw new TimeoutError('rpc timed out', {
            queue: queueName,
            content: args.content,
            opts: opts
          })
        })
      )
    }
    var deleteQueue = function () {
      return new Promise(function (resolve, reject) {
        if (!_replyQueue) {
          resolve()
        }
        channel.deleteQueue(_replyQueue.queue)
          .catch(reject)
          .then(resolve)
      })
    }
    return Promise.race(promises)
      .catch(function (err) {
        debug('Error:', err.stack)
        // close queue and channel if error occurs
        channelCloseEventPromise.cancel()
        return deleteQueue()
          .catch(function (delErr) {
            debug('Ignored delete queue error:', delErr.stack)
          })
          .then(function () {
            if (err instanceof ChannelCloseError) {
              // channel already closed just throw error
              throw err
            }
            return channel.close().catch(function (closeErr) {
              debug('Ignored close channel error:', closeErr.stack)
            })
          })
          .then(function () {
            // throw original error
            throw err
          })
      }).then(function (message) {
        debug('Success:', message)
        // close queue and channel after success
        channelCloseEventPromise.cancel()
        return deleteQueue()
          .then(function () {
            return channel.close()
          })
          .then(function () {
            // resolve reply message
            return message
          })
      })
  })
  // promise or callback
  return maybe(cb, promise)
}
