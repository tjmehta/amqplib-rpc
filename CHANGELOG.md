# amqplib-rpc changelog

# 3.0.0
* reply
  * Breaking changes! remove correlationId requirement in replies

# 2.0.3
* request
  * Fix: exclusive queues stay open even after channel close
  * `request` now manually deletes queue after response is received

# 2.0.2
* request
  * Fix: fix options: correlationId and replyTo

# 2.0.1
* checkReplyQueue
  * Now yields exists (boolean)
* checkQueue
  * Now yields exists (boolean)
* QueueNotFoundError
  * Removed

# 2.0.0
* reply
  * Breaking changes! Reverted to 0.2.0 behavior, it was more flexible, and more useful in majority of use cases
  * Broke out checkQueue into it's own helper
* checkReplyQueue
  * Initial implementation
* checkQueue
  * Initial implementation
* TimeoutError
  * Fixed missing message
* QueueNotFoundError
  * Fixed missing message
* Readme
  * New examples

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
