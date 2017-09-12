var Channel = require('amqplib/lib/channel_model').Channel
var Code = require('code')
var Lab = require('lab')
var put = require('101/put')
var sinon = require('sinon')

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

var reply = require('../index.js').reply

describe('reply', function () {
  var ctx

  beforeEach(function (done) {
    ctx = {}
    ctx.channel = new Channel()
    ctx.ret = {}
    sinon.stub(ctx.channel, 'sendToQueue').returns(ctx.ret)
    ctx.message = {
      properties: {
        replyTo: 'replyTo',
        correlationId: 'correlationId'
      }
    }
    ctx.opts = {}
    done()
  })

  describe('success', function () {
    describe('object content', function () {
      beforeEach(function (done) {
        ctx.content = {}
        ctx.bufferContent = new Buffer(JSON.stringify({}))
        done()
      })
      it('should reply to a request', assertSuccess)
    })

    describe('array content', function () {
      beforeEach(function (done) {
        ctx.content = []
        ctx.bufferContent = new Buffer(JSON.stringify([]))
        done()
      })
      it('should reply to a request', assertSuccess)
    })

    describe('string content', function () {
      beforeEach(function (done) {
        ctx.content = 'content'
        ctx.bufferContent = new Buffer('content')
        done()
      })
      it('should reply to a request', assertSuccess)
    })

    describe('number content', function () {
      beforeEach(function (done) {
        ctx.content = 22
        ctx.bufferContent = new Buffer('22')
        done()
      })
      it('should reply to a request', assertSuccess)
    })

    describe('buffer content', function () {
      beforeEach(function (done) {
        ctx.content = new Buffer('content')
        ctx.bufferContent = ctx.content
        done()
      })
      it('should reply to a request', assertSuccess)
      it('should reply to a request without correlationId', (done) => {
        delete ctx.message.properties.correlationId
        assertSuccess(done)
      })
    })

    function assertSuccess (done) {
      var corrId = ctx.message.properties.correlationId
      var expectedOpts = (corrId)
        ? put(ctx.opts, { correlationId: corrId })
        : ctx.opts
      expect(
        reply(ctx.channel, ctx.message, ctx.content, ctx.opts)
      ).to.equal(ctx.ret)
      sinon.assert.calledOnce(ctx.channel.sendToQueue)
      sinon.assert.calledWith(ctx.channel.sendToQueue,
        ctx.message.properties.replyTo,
        bufferMatch(ctx.bufferContent),
        expectedOpts
      )
      done()
    }
  })

  describe('errors', function () {
    it('should error if not passed a channel', function (done) {
      expect(function () {
        reply(null, ctx.message, ctx.content, ctx.opts)
      }).to.throw(/channel/)
      expect(function () {
        reply({}, ctx.message, ctx.content, ctx.opts)
      }).to.throw(/channel/)
      done()
    })

    it('should error if no "replyTo"', function (done) {
      delete ctx.message.properties.replyTo
      expect(function () {
        reply(ctx.channel, ctx.message, ctx.content, ctx.opts)
      }).to.throw(/replyTo/)
      done()
    })
  })
})
