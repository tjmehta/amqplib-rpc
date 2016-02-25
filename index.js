module.exports = {
  request: require('./lib/request.js'),
  reply: require('./lib/reply.js'),
  TimeoutError: require('./lib/errors/timeout-error.js'),
  ChannelCloseError: require('./lib/errors/channel-close-error.js'),
  QueueNotFoundError: require('./lib/errors/queue-not-found-error.js')
}
