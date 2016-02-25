var assertArgs = require('assert-args')
var first = require('first-event')
var maybe = require('call-me-maybe')
var throwNextTick = require('throw-next-tick')

var isConnection = require('./is-connection.js')
var ChannelCloseError = require('./errors/channel-close-error.js')

var isQueue404ChannelError = function (err) {
  return err.code === 404 && /no queue/.test(err.message)
}

module.exports = checkQueue

/**
 * create a channel, check if the queue exists, and close the channel
 * @param  {AmqpblibConnection}   connection amqplib rabbitmq connection
 * @param  {String}   queue    queue name
 * @param  {Function} [cb]     callback, not required if using promises
 * @return {Promise}  if using promises
 */
function checkQueue (connection, queue, cb) {
  assertArgs(arguments, {
    'connection': isConnection,
    'queue': 'string',
    '[cb]': 'function'
  })
  var promise = connection.createChannel().then(function (channel) {
    var errData = { queue: queue }
    // promises
    var channelEvents = first(channel, ['error', 'close'])
    var channelEventsCancel = channelEvents.cancel
    channelEvents = channelEvents
      .then(function () {
        // channel 'close' event
        throw new ChannelCloseError('channel closed before checking the queue\'s existance', errData)
      })
      .catch(function (err) {
        // channel 'error' event, checkQueue error can end up here
        // no need to close channel; should be closed
        if (isQueue404ChannelError(err)) {
          return false // queue does not exist
        } else if (err instanceof ChannelCloseError) {
          throw err // don't throw next tick, channel 'close' event
        } else {
          // error events are thrown if they do not have handlers
          // channel errors should be uncaught exceptions and crash the process
          err.data = errData
          throwNextTick(err)
        }
      })
    var replyPromise = channel.checkQueue(queue)
      .then(function () {
        channelEventsCancel()
        return channel.close().then(function () {
          return true // queue exists
        })
      })
      .catch(function (err) {
        // note: the only error I know of is 404 queue which will result in channel 'error' event
        //       it's possible this code will never be hit
        channelEventsCancel()
        return channel.close().then(function () {
          err.data = errData
          throw err // some unexpected error
        })
      })
    // race
    return Promise.race([
      channelEvents,
      replyPromise
    ])
  })
  // callback or return promise
  return maybe(cb, promise)
}
