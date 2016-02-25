module.exports = {
  request: require('./lib/request.js'),
  reply: require('./lib/reply.js'),
  checkReplyQueue: require('./lib/check-reply-queue.js'),
  checkQueue: require('./lib/check-queue.js'),
  TimeoutError: require('./lib/errors/timeout-error.js'),
  ChannelCloseError: require('./lib/errors/channel-close-error.js')
}
