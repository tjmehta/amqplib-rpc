# amqplib-rpc [![Build Status](https://travis-ci.org/tjmehta/amqplib-rpc.svg?branch=master)](https://travis-ci.org/tjmehta/amqplib-rpc)
Thin Amplib utils for RabbitMQ RPC in Node.js. Uses `replyTo` and `correlationId` message properties as the [RabbitMQ rpc tutorial](https://www.rabbitmq.com/tutorials/tutorial-six-javascript.html) suggests.

# Installation
```bash
npm i --save amqplib-rpc
```

# Usage
## request
Make an rpc request, publish a message to an rpc queue.

* Creates a channel, queue, correlationId, and sets up `properties.replyTo` and `properties.correlationId` on request message.

```js
/**
  * @param  {AmqplibConnection}   connection     rabbitmq connection
  * @param  {String}   queue     name of rpc-queue to send the message to
  * @param  {Buffer}   content   message content
  * @param  {Object}   [opts]  sendToQueue options
  * @param  {Object}   [opts.timeout]  timeout in ms, will reject w/ TimeoutError, default: undefined (no timeout)
  * @param  {Object}   [opts.sendOpts]  sendToQueue options
  * @param  {Object}   [opts.queueOpts] assertQueue options for replyTo queue, queueOpts.exclusive defaults to true
  * @param  {Object}   [opts.consumeOpts] consume options for replyTo queue, consumeOpts defaults to true
  * @param  {Function} [cb] optional callback, if using callback api
  * @return {Promise}  returns a promise, if using promise api
  */
```
##### request examples, rpc client
```js
// Promise api example
var amqplib = require('amqplib')
var request = require('amqplib-rpc').request

amqplib.connect().then(function (connection) {
  return request(connection, 'multiply-queue', { a: 10, b: 20 }).then(function (replyMessage) {
    console.log(replyMessage.content.toString()) // 200
  })
})
.catch(...)

// Callback api example
var amqplib = require('amqplib/callback_api')
var request = require('amqplib-rpc').request

amqplib.connect(function (err, connection) {
  if (err) throw err
  var content = { a: 10, b: 20 } // gets converted to buffer automatically
  // RPC request
  request(connection, 'multiply-queue', content, function (err, replyMessage) {
    if (err) throw err
    console.log(replyMessage.content.toString()) // 200
  })
})

// Timeout Error example
// triggered by timeout option
var amqplib = require('amqplib')
var request = require('amqplib-rpc').request
var TimeoutError = require('amqplib-rpc').TimeoutError

amqplib.connect(function (err, connection) {
  if (err) throw err
  var content = { a: 10, b: 20 } // gets converted to buffer automatically
  var opts = { timeout: 100 }
  // RPC request
  request(connection, 'multiply-queue', content, opts, function (err, replyMessage) {
    console.log(err) // [TimeoutError: 'rpc timed out']
    console.log(err instanceof TimeoutError) // true
    console.log(err.data)
    /*
    {
      timeout: 100
      queue: 'multiplyQueue',
      content: { a: 10, b: 20 },
      opts: { // shows default opts in since only timeout was passed
        timeout: 100
        sendOpts: {},
        queueOpts: {
          exclusive: true
        },
        consumeOpts: {
          noAck: true
        }
      }
    }
    */
  })
})

// Channel Close Error example
// occurs if channel is closed before the response is received from rpc
var amqplib = require('amqplib')
var request = require('amqplib-rpc').request
var ChannelCloseError = require('amqplib-rpc').ChannelCloseError

amqplib.connect(function (err, connection) {
  if (err) throw err
  var content = { a: 10, b: 20 } // gets converted to buffer automatically
  var opts = { timeout: 100 }
  // RPC request
  request(connection, 'multiply-queue', content, opts, function (err, replyMessage) {
    console.log(err) // [ChannelCloseError: 'rpc channel closed before receiving the response message']
    console.log(err instanceof ChannelCloseError) // true
    console.log(err.data) // same as Timeout Error example above
  })
})
```

## reply
Reply to an rpc request, publish a message to replyTo queue.

* Replies to a message using `properties.replyTo` and `properties.correlationId`.

* Reply will NOT error if the "replyTo" queue does not exist, if you need it to use `checkReplyTo` (example below).

* Reply will NOT `ack` the `message`. Ack/Nack must be done manually.
```js
/**
 * @param  {AmqplibChannel} channel on which the message was recieved
 * @param  {Object} message incoming message on channel
 * @param  {Buffer|Object|Array|String} content message content
 * @param  {Object} opts publish options
 * @return {Boolean} replyWriteSuccess - amqplib docs do not mention this ever failing..
 */
```
##### reply example, rpc server
```js
var amqplib = require('amqplib/callback_api')
var reply = require('amqplib-rpc').reply

amqplib.connect(function (err, connection) {
  if (err) throw err
  connection.createChannel(function (err, consumerChannel) {
    if (err) throw err
    connection.createChannel(function (err, publisherChannel) {
      if (err) throw err
      consumerChannel.consume('multiply-queue', messageHandler, function (err) {
        if (err) throw err
      })
      function messageHandler (message) {
        var json = JSON.parse(message.content.toString())
        var content = json.a * json.b // gets converted to buffer automatically
        var opts = {} // optional
        // RPC reply
        reply(publisherChannel, message, content, opts)
        // "ack" message
        consumerChannel.ack(message)
      }
    })
  })
})
```

## checkReplyQueue
Create a channel, check if replyTo queue exists, and close the channel.
`checkReplyQueue` creates it's own channel, bc checking for a non-existant queue errors and closes the channel.
```js
/**
 * @param  {AmqpblibConnection}   connection amqplib rabbitmq connection
 * @param  {Object}   message    request queue message
 * @param  {Function} [cb]       not required if using promises
 * @return {Promise}  if using promises
 */
```
##### checkReplyQueue before reply example, rpc server
```js
var amqplib = require('amqplib/callback_api')
var reply = require('amqplib-rpc').reply
var checkReplyQueue = require('amqplib-rpc').checkReplyQueue
var QueueNotFound = require('amqplib-rpc').QueueNotFound

amqplib.connect(function (err, connection) {
  if (err) throw err
  connection.createChannel(function (err, consumerChannel) {
    if (err) throw err
    connection.createChannel(function (err, publisherChannel) {
      if (err) throw err
      consumerChannel.consume('multiply-queue', messageHandler, function (err) {
        if (err) throw err
      })
      function messageHandler (message) {
        var json = JSON.parse(message.content.toString())
        var content = json.a * json.b // gets converted to buffer automatically
        var opts = {} // optional
        // Check replyTo queue exists, note: also support promise api
        checkReplyQueue(connection, message, function (err, exists) {
          if (err) throw err
          if (!exists) {
            // "replyTo" queue no longer exists
            // ack, nack, or etc.
            return
          }
          // RPC reply
          reply(publisherChannel, message, content, opts)
          // "ack" message
          consumerChannel.ack(message)
        })
      }
    })
  })
})
```

## checkQueue
Create a channel, check if the queue exists, and close the channel. This is not rpc related but was implemented for `checkReplyQueue`, so I've exported it.
In some cases, it may be useful to check if a queue exists before publishing to it.
```js
/*
 * @param  {AmqpblibConnection}   connection amqplib rabbitmq connection
 * @param  {String}   queue    queue name
 * @param  {Function} [cb]     callback, not required if using promises
 * @return {Promise}  if using promises
 */
```
##### checkReplyQueue before reply example, rpc server
```js
var amqplib = require('amqplib/callback_api')
var reply = require('amqplib-rpc').reply
var checkQueue = require('amqplib-rpc').checkQueue
var QueueNotFound = require('amqplib-rpc').QueueNotFound

amqplib.connect(function (err, connection) {
  if (err) throw err
  connection.createChannel(function (err, channel) {
    if (err) throw err
    var queue = 'some-queue'
    // Check replyTo queue exists, note: also support promise api
    checkQueue(connection, queue, function (err, exists) {
      if (err) throw err
      if (!exists) {
        // queue does not exist, do something special
        return
      }
      // publish message to queue
      channel.sendToQueue(queue, content)
    })
  })
})
```

# Follows RabbitMQ RPC tutorial
https://www.rabbitmq.com/tutorials/tutorial-six-javascript.html

# Changelog
[CHANGELOG.md](https://github.com/tjmehta/amqplib-rpc/blob/master/CHANGELOG.md)

# License
MIT