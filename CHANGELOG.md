# amqplib-rpc changelog

# 1.0.0
* reply
  * Breaking changes! `reply` is now an async method (supports cb and promise apis)
  * `reply` has become async bc it checks replyTo queue's existance before publishing the response message
  * `reply` now accepts a connection instead of channel and creates it's own channel.
* QueueNotFoundError
  * Initial implementation
  * Can be yielded from reply, if `replyTo` queue does not exist
* ChannelCloseError
  * Initial implementation
  * Can be yielded from request, if the channel closes before receiving the response message
  * Can be yielded from reply, if the channel closes before publishing the response message

# 0.2.0
* request
  * Added timeout support, `opts.timeout`
* TimeoutError
  * Initial implementation

# 0.1.0
* request
  * Initial implementation
* reply
  * Initial implementation