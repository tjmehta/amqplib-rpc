global.Promise = global.Promise || require('promise-polyfill')

var amqplib = require('amqplib')
var Code = require('code')
var Lab = require('lab')

var request = require('../').request
var reply = require('../').reply

var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var expect = Code.expect

var RABBIT_HOST = process.env.RABBIT_HOST || 'amqp://localhost:5672'

describe('e2e test', function () {
  beforeEach(function (done) {
    amqplib.connect(RABBIT_HOST).then(function (connection) {
      // setup rpc server
      return connection.createChannel().then(function (consumerChannel) {
        return connection.createChannel().then(function (publisherChannel) {
          consumerChannel.assertQueue('multiply-queue', { durable: false })
          return consumerChannel.consume('multiply-queue', messageHandler)
          function messageHandler (message) {
            var json = JSON.parse(message.content.toString())
            var content = json.a * json.b // gets converted to buffer automatically
            var opts = {} // optional
            // RPC reply
            reply(publisherChannel, message, content, opts)
            consumerChannel.ack(message)
          }
        })
      })
    }).then(function () {
      done()
    }).catch(done)
  })

  it('should rpc', function (done) {
    amqplib.connect(RABBIT_HOST).then(function (connection) {
      return request(connection, 'multiply-queue', { a: 10, b: 20 }).then(function (replyMessage) {
        expect(replyMessage.content.toString()).to.equal('200')
      })
    }).then(function () {
      done()
    }).catch(done)
  })
})
