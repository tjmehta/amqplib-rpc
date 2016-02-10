var first = require('first-event')
var uuid = require('uuid')

module.exports = replyPromise
/**
 * create a reply promise, race errors w/ reply-queue consume message
 * @param  {AmqplibChannel} channel
 * @param  {String} replyQueueName   reply queue name
 * @param  {Object} consumeOpts   consume options
 * @return {Promise} message promise
 */
function replyPromise (channel, replyQueueName, consumeOpts) {
  var corrId = uuid.v4()
  var alreadyClosed = new Promise(function (resolve, reject) {
    if (channel.__closed) {
      return reject(new Error('rpc channel exited before recieving reply message'))
    }
    // don't resolve
  })
  var closeEvents = first(channel, ['error', 'exit'])
  var cancelListeners = closeEvents.cancel
  closeEvents = closeEvents.then(function () {
    // exit occurred
    throw new Error('rpc channel exited before recieving reply message')
  })
  var replyMessage = new Promise(function (resolve, reject) {
    channel
      .consume(replyQueueName, messageHandler, consumeOpts)
      .catch(reject)
    function messageHandler (message) {
      if (message.properties.correlationId === corrId) {
        cancelListeners() // remove 'error' and 'exit' event handler
        resolve(message)
      }
    }
  })

  return Promise.race([alreadyClosed, closeEvents, replyMessage])
}
