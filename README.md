# amqplib-rpc [![Build Status](https://travis-ci.org/tjmehta/amqplib-rpc.svg?branch=master)](https://travis-ci.org/tjmehta/amqplib-rpc)
Thin Amplib utils for RabbitMQ RPC in Node.js. Uses `replyTo` and `correlationId` message properties as the [RabbitMQ rpc tutorial](https://www.rabbitmq.com/tutorials/tutorial-six-javascript.html) suggests.

# Installation
```bash
npm i --save amqplib-rpc
```

# Usage
## request
Make an rpc request, publish a message to an rpc queue. Automatically creates a channel, queue, correlationId, and sets up `properties.replyTo` and `properties.correlationId`
```js
/**
  * @param  {AmqplibConnection}   connection     rabbitmq connection
  * @param  {String}   queue     name of rpc-queue to send the message to
  * @param  {Buffer}   content   message content
  * @param  {Object}   [opts]  sendToQueue options
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
```

## reply
Reply to an rpc request, publish a message to replyTo queue. Replies to a message using `properties.replyTo` and `properties.correlationId`.
```js
/**
 * @param  {AmqplibChannel} channel on which the message was recieved
 * @param  {Object} message incoming message on channel
 * @param  {Buffer|Object|Array|String} content message content
 * @param  {Object} opts publish options
 */
```
##### reply example, rpc server
```js
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
      reply(channel, message, content, opts)
    }
  })
})
```

# Follows RabbitMQ RPC tutorial
https://www.rabbitmq.com/tutorials/tutorial-six-javascript.html

# License
MIT