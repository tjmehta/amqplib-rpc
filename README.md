# amqplib-rpc [![Build Status](https://travis-ci.org/tjmehta/amqplib-rpc.svg?branch=master)](https://travis-ci.org/tjmehta/amqplib-rpc)
Thin Amplib utils for RabbitMQ RPC in Node.js. Uses `replyTo` and `correlationId` message properties as the [RabbitMQ rpc tutorial](https://www.rabbitmq.com/tutorials/tutorial-six-javascript.html) suggests.

# Installation
```bash
npm i --save amqplib-rpc
```

# Usage
## request
Make an rpc request, publish a message to an rpc queue. Creates a channel, queue, correlationId, and sets up `properties.replyTo` and `properties.correlationId` on request message.
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
Make an rpc request, publish a message to an rpc queue. Creates a channel, checks `replyTo` queue exists, and replies to a message using `properties.replyTo` and `properties.correlationId`.
```js
/**
 * @param  {AmqplibConnection} amqplib connection on which to create channel and reply on
 * @param  {Object} message incoming message on channel
 * @param  {Buffer|Object|Array|String} content message content
 * @param  {Object} [opts] sendToQueue options
 * @param  {Function} [cb] optional callback
 * @return {Promise}  returns a promise, only if using promise api
 */
```
##### reply example, rpc server
```js
// Promise api example
var amqplib = require('amqplib/callback_api')
var reply = require('amqplib-rpc').reply

amqplib.connect().then(function (connection) {
  return connection.createChannel().then(function (channel) {
    channel.consume('multiply-queue', messageHandler, function (err) {
      if (err) throw err
    })
    function messageHandler (message) {
      var json = JSON.parse(message.content.toString())
      var content = json.a * json.b // gets converted to buffer automatically
      var opts = {} // optional
      // RPC reply
      return reply(connection, message, content, opts).then(function () {
        // message sent successfully
      })
    }
  })
}).catch(...)

// Callback api example
var amqplib = require('amqplib/callback_api')
var reply = require('amqplib-rpc').reply

amqplib.connect(function (err, connection) {
  if (err) throw err
  connection.createChannel(function (err, channel) {
    channel.consume('multiply-queue', messageHandler, function (err) {
      if (err) throw err
    })
    function messageHandler (message) {
      var json = JSON.parse(message.content.toString())
      var content = json.a * json.b // gets converted to buffer automatically
      var opts = {} // optional
      // RPC reply
      reply(connection, message, content, opts, function (err) {
        if (err) throw err
        // message sent successfully
      })
    }
  })
})

// Queue Not Found Error example
// occurs if replyTo queue has been deleted
var amqplib = require('amqplib/callback_api')
var reply = require('amqplib-rpc').reply
var QueueNotFoundError = require('amqplib-rpc').QueueNotFoundError

amqplib.connect(function (err, connection) {
  if (err) throw err
  connection.createChannel(function (err, channel) {
    channel.consume('multiply-queue', messageHandler, function (err) {
      if (err) throw err // else consumer messageHandler is set
    })
    function messageHandler (message) {
      var json = JSON.parse(message.content.toString())
      var content = json.a * json.b // gets converted to buffer automatically
      var opts = {} // optional
      // RPC reply
      reply(connection, message, content, opts, function (err) {
        console.log(err) // [QueueNotFoundError: 'rpc timed out']
        console.log(err instanceof QueueNotFoundError) // true
        console.log(err.data)
        /*
        {
          queue: '<replyTo queue name>',
          correlationId: '<rpc correlation id>',
          message: {..request message..},
          content: 200, // response content: json.a * json.b
          opts: {..reply opts..}
        }
        */
      })
    }
  })
})

// Channel Close Error example
// occurs if replyTo queue has been deleted
var amqplib = require('amqplib/callback_api')
var reply = require('amqplib-rpc').reply
var ChannelCloseError = require('amqplib-rpc').ChannelCloseError

amqplib.connect(function (err, connection) {
  if (err) throw err
  connection.createChannel(function (err, channel) {
    channel.consume('multiply-queue', messageHandler, function (err) {
      if (err) throw err // else consumer messageHandler is set
    })
    function messageHandler (message) {
      var json = JSON.parse(message.content.toString())
      var content = json.a * json.b // gets converted to buffer automatically
      var opts = {} // optional
      // RPC reply
      reply(connection, message, content, opts, function (err) {
        console.log(err) // [ChannelCloseError: 'rpc channel closed before publishing the response message']
        console.log(err instanceof ChannelCloseError) // true
        console.log(err.data) // same as ChannelCloseError example above
      })
    }
  })
})
```

# Follows RabbitMQ RPC tutorial
https://www.rabbitmq.com/tutorials/tutorial-six-javascript.html

# Changelog
[CHANGELOG.md](https://github.com/tjmehta/amqplib-rpc/blob/master/CHANGELOG.md)

# License
MIT