var Channel = require('amqplib/lib/channel_model').Channel
var Code = require('code')
var Lab = require('lab')
var proxyquire = require('proxyquire')
var sinon = require('sinon')
require('sinon-as-promised')

var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var expect = Code.expect

describe('replyPromise', function () {
  var ctx

  beforeEach(function (done) {
    ctx = {}
    ctx.channel = new Channel()
    sinon.stub(ctx.channel, 'consume')
    ctx.replyQueueName = 'replyQueueName'
    ctx.consumeOpts = { noAck: true }
    ctx.corrId = 1
    ctx.replyPromise = proxyquire('../lib/reply-promise.js', {
      uuid: {
        v4: sinon.stub().returns(ctx.corrId)
      }
    })
    ctx.replyMessage = {
      properties: {
        correlationId: ctx.corrId
      }
    }
    done()
  })

  describe('channel already closed', function () {
    it('should error', function (done) {
      ctx.channel.__closed = true
      ctx.replyPromise(ctx.channel, ctx.replyQueueName, ctx.consumeOpts)
        .then(function () {
          done(new Error('expected an error'))
        })
        .catch(function (err) {
          expect(err).to.exist()
          expect(err.message).to.match(/rpc channel exited/)
          done()
        })
        .catch(done)
    })
  })

  describe('channel exit', function () {
    it('should error', function (done) {
      ctx.channel.consume
        .callsArgWithAsync(1, { properties: {} }) // invalid message
        .returns(new Promise(function () {}))
      ctx.replyPromise(ctx.channel, ctx.replyQueueName, ctx.consumeOpts)
        .then(function () {
          done(new Error('expected an error'))
        })
        .catch(function (err) {
          expect(err).to.exist()
          expect(err.message).to.match(/rpc channel exited/)
          done()
        })
        .catch(done)
      ctx.channel.emit('exit')
    })
  })

  describe('successful reply', function () {
    it('should race channel alreadyClosed, closeEvents and replyMessage', function (done) {
      ctx.channel.consume
        .callsArgWithAsync(1, ctx.replyMessage)
        .returns(Promise.resolve())
      ctx.replyPromise(ctx.channel, ctx.replyQueueName, ctx.consumeOpts)
        .then(function (replyMessage) {
          expect(replyMessage).to.equal(ctx.replyMessage)
          done()
        })
        .catch(done)
      sinon.assert.calledOnce(ctx.channel.consume)
      // console.log(ctx.channel.consume)
      // ctx.channel.consume.callsArgWithAsync(1, ctx.replyMessage)
    })
  })
})
