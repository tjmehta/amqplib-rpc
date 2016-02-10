var EventEmitter = require('events').EventEmitter

var Channel = require('amqplib/lib/channel_model').Channel
var Code = require('code')
var Connection = require('amqplib/lib/channel_model').ChannelModel
var Lab = require('lab')
var proxyquire = require('proxyquire')
var shimmer = require('shimmer')
var sinon = require('sinon')
require('sinon-as-promised')

var bufferMatch = function (a) {
  return sinon.match(function (b) {
    return a.toString() === b.toString()
  })
}

var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var expect = Code.expect

describe('request', function () {
  var ctx

  beforeEach(function (done) {
    ctx = {}
    ctx.replyPromise = sinon.stub()
    ctx.request = proxyquire('../lib/request.js', {
      './reply-promise.js': ctx.replyPromise
    })
    // stubbed connection
    ctx.connection = new Connection(new EventEmitter())
    sinon.stub(ctx.connection, 'createChannel')
    // stubbed channel
    ctx.replyQueue = { queue: 'replyQueueName' }
    ctx.channel = new Channel()
    sinon.stub(ctx.channel, 'assertQueue')
    sinon.stub(ctx.channel, 'sendToQueue')
    sinon.stub(ctx.channel, 'close')
    // queue args
    ctx.rpcQueueName = 'rpc-queue'
    ctx.opts = {}
    done()
  })

  describe('success', function () {
    describe('amqplib promise api', function () {
      beforeEach(function (done) {
        ctx.replyMessage = {}
        ctx.replyPromise.resolves(ctx.replyMessage)
        ctx.connection.createChannel.resolves(ctx.channel)
        ctx.channel.assertQueue.resolves(ctx.replyQueue)
        ctx.channel.sendToQueue.resolves()
        ctx.channel.close.resolves()
        done()
      })

      describe('object content', function () {
        beforeEach(function (done) {
          ctx.content = {}
          ctx.bufferContent = new Buffer(JSON.stringify({}))
          done()
        })
        it('should make a request and recieve a reply', assertSuccess)
      })
      describe('array content', function () {
        beforeEach(function (done) {
          ctx.content = []
          ctx.bufferContent = new Buffer(JSON.stringify([]))
          done()
        })
        it('should make a request and recieve a reply', assertSuccess)
      })
      describe('string content', function () {
        beforeEach(function (done) {
          ctx.content = 'content'
          ctx.bufferContent = new Buffer('content')
          done()
        })
        it('should make a request and recieve a reply', assertSuccess)
      })
      describe('number content', function () {
        beforeEach(function (done) {
          ctx.content = 22
          ctx.bufferContent = new Buffer('22')
          done()
        })
        it('should make a request and recieve a reply', assertSuccess)
      })
      describe('buffer content', function () {
        beforeEach(function (done) {
          ctx.content = new Buffer('content')
          ctx.bufferContent = ctx.content
          done()
        })
        it('should make a request and recieve a reply', assertSuccess)
      })

      describe('callback api', function () {
        beforeEach(function (done) {
          ctx.content = new Buffer('content')
          ctx.bufferContent = ctx.content
          done()
        })
        it('should make a request and recieve a reply', assertSuccess)
      })

      function assertSuccess (done) {
        ctx.request(ctx.connection, ctx.rpcQueueName, ctx.content, ctx.opts, function (err, replyMessage) {
          if (err) { return done(err) }
          expect(replyMessage).to.equal(ctx.replyMessage)
          sinon.assert.calledOnce(ctx.connection.createChannel)
          sinon.assert.calledOnce(ctx.channel.assertQueue)
          sinon.assert.calledWith(ctx.channel.assertQueue, '', { exclusive: true })
          sinon.assert.calledOnce(ctx.channel.sendToQueue)
          sinon.assert.calledWith(ctx.channel.sendToQueue, ctx.rpcQueueName, bufferMatch(ctx.bufferContent), {})
          sinon.assert.calledOnce(ctx.replyPromise)
          sinon.assert.calledWith(ctx.replyPromise, ctx.channel, ctx.replyQueue.queue, { noAck: true })
          done()
        })
      }
    })
  })

  describe('errors', function () {
    describe('invalid connection arg', function () {
      it('should throw error', function (done) {
        ctx.content = 'content'
        expect(function () {
          ctx.request(null, ctx.rpcQueueName, ctx.content, ctx.opts)
        }).to.throw(/connection/)
        expect(function () {
          ctx.request({}, ctx.rpcQueueName, ctx.content, ctx.opts)
        }).to.throw(/connection/)
        done()
      })
    })

    describe('createChannel error', function () {
      beforeEach(function (done) {
        ctx.err = new Error('boom')
        ctx.connection.createChannel.resolves(ctx.channel)
        ctx.channel.assertQueue.rejects(ctx.err)
        ctx.channel.close.resolves()
        ctx.content = 'content'
        done()
      })

      it('should close connection yield error', function (done) {
        ctx.request(ctx.connection, ctx.rpcQueueName, ctx.content, ctx.opts)
          .then(function () {
            done(new Error('expected an error'))
          })
          .catch(function (err) {
            expect(err).to.equal(ctx.err)
            sinon.assert.calledOnce(ctx.channel.close)
            done()
          })
          .catch(done)
      })

      describe('channel closed', function () {
        beforeEach(function (done) {
          shimmer.wrap(ctx.channel, 'assertQueue', function (orig) {
            return function () {
              var ret = orig.apply(this, arguments)
              // close the channel
              ctx.channel.emit('exit')
              return ret.then(function () {})
            }
          })
          done()
        })

        it('should yield error (channel already closed)', function (done) {
          ctx.request(ctx.connection, ctx.rpcQueueName, ctx.content, ctx.opts)
            .then(function () {
              done(new Error('expected an error'))
            })
            .catch(function (err) {
              expect(err).to.equal(ctx.err)
              done()
            })
            .catch(done)
        })
      })
    })
  })
})
