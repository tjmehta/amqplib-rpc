var EventEmitter = require('events').EventEmitter

var Channel = require('amqplib/lib/channel_model').Channel
var Code = require('code')
var Connection = require('amqplib/lib/channel_model').ChannelModel
var errToJSON = require('utils-error-to-json')
var Lab = require('lab')
var put = require('101/put')
var proxyquire = require('proxyquire')
var ChannelCloseError = require('../lib/errors/channel-close-error.js')
var QueueNotFoundError = require('../lib/errors/queue-not-found-error.js')
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

describe('reply', function () {
  var ctx

  beforeEach(function (done) {
    ctx = {}
    // stubbed connection
    ctx.connection = new Connection(new EventEmitter())
    sinon.stub(ctx.connection, 'createChannel')
    // stubbed channel
    ctx.channel = new Channel()
    sinon.stub(ctx.channel, 'checkQueue')
    sinon.stub(ctx.channel, 'sendToQueue')
    sinon.stub(ctx.channel, 'close')
    ctx.message = {
      properties: {
        replyTo: 'replyTo',
        correlationId: 'correlationId'
      }
    }
    ctx.content = 'content'
    ctx.opts = {}
    ctx.throwNextTick = sinon.spy(function (err) {
      throw err
    })
    ctx.reply = proxyquire('../lib/reply.js', {
      'throw-next-tick': ctx.throwNextTick
    })
    done()
  })

  describe('success', function () {
    beforeEach(function (done) {
      ctx.connection.createChannel.resolves(ctx.channel)
      ctx.channel.checkQueue.resolves()
      ctx.ret = true
      ctx.channel.sendToQueue.returns(ctx.ret)
      ctx.channel.close.resolves()
      done()
    })

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
    })

    describe('callback api', function () {
      describe('buffer content', function () {
        beforeEach(function (done) {
          ctx.content = new Buffer('content')
          ctx.bufferContent = ctx.content
          done()
        })
        it('should reply to a request', function (done) {
          var replyTo = ctx.message.properties.replyTo
          var corrId = ctx.message.properties.correlationId
          ctx.reply(ctx.connection, ctx.message, ctx.content, ctx.opts, function (err, ret) {
            expect(err).to.not.exist()
            sinon.assert.calledOnce(ctx.connection.createChannel)
            sinon.assert.calledOnce(ctx.channel.checkQueue)
            sinon.assert.calledWith(ctx.channel.checkQueue, replyTo)
            sinon.assert.calledOnce(ctx.channel.sendToQueue)
            sinon.assert.calledWith(ctx.channel.sendToQueue,
              ctx.message.properties.replyTo,
              bufferMatch(ctx.bufferContent),
              put(ctx.opts, { correlationId: corrId }))
            sinon.assert.calledOnce(ctx.channel.close)
            expect(ret).to.equal(ctx.ret)
            done()
          })
        })
      })
    })

    function assertSuccess (done) {
      var replyTo = ctx.message.properties.replyTo
      var corrId = ctx.message.properties.correlationId
      ctx.reply(ctx.connection, ctx.message, ctx.content, ctx.opts)
        .then(function (ret) {
          sinon.assert.calledOnce(ctx.connection.createChannel)
          sinon.assert.calledOnce(ctx.channel.checkQueue)
          sinon.assert.calledWith(ctx.channel.checkQueue, replyTo)
          sinon.assert.calledOnce(ctx.channel.sendToQueue)
          sinon.assert.calledWith(ctx.channel.sendToQueue,
            ctx.message.properties.replyTo,
            bufferMatch(ctx.bufferContent),
            put(ctx.opts, { correlationId: corrId }))
          sinon.assert.calledOnce(ctx.channel.close)
          expect(ret).to.equal(ctx.ret)
          done()
        })
        .catch(done)
    }
  })

  describe('errors', function () {
    it('should error if not passed a connection', function (done) {
      expect(function () {
        ctx.reply(null, ctx.message, ctx.content, ctx.opts)
      }).to.throw(/connection/)
      expect(function () {
        ctx.reply({}, ctx.message, ctx.content, ctx.opts)
      }).to.throw(/connection/)
      done()
    })

    it('should error if no "replyTo"', function (done) {
      delete ctx.message.properties.replyTo
      expect(function () {
        ctx.reply(ctx.connection, ctx.message, ctx.content, ctx.opts)
      }).to.throw(/replyTo/)
      done()
    })

    it('should error if no "correlationId"', function (done) {
      delete ctx.message.properties.correlationId
      expect(function () {
        ctx.reply(ctx.connection, ctx.message, ctx.content, ctx.opts)
      }).to.throw(/correlationId/)
      done()
    })

    describe('channel checkQueue error', function () {
      beforeEach(function (done) {
        ctx.connection.createChannel.resolves(ctx.channel)
        ctx.channel.close.resolves()
        done()
      })

      it('should throw queue 404 error', function (done) {
        var replyTo = ctx.message.properties.replyTo
        var corrId = ctx.message.properties.correlationId
        ctx.err = new Error('Channel closed by server: 404 (NOT-FOUND) with message "NOT_FOUND - no queue \'' + replyTo + '\' in vhost \'/\'"')
        ctx.err.code = 404
        ctx.channel.checkQueue.rejects(ctx.err)
        ctx.reply(ctx.connection, ctx.message, ctx.content, ctx.opts)
          .then(function () {
            done(new Error('expected an error'))
          })
          .catch(function (err) {
            expect(err).to.be.an.instanceOf(QueueNotFoundError)
            expect(err.data).to.deep.equal({
              queue: replyTo,
              correlationId: corrId,
              message: ctx.message,
              content: ctx.content,
              opts: ctx.opts,
              err: errToJSON(ctx.err)
            })
            done()
          })
          .catch(done)
      })

      it('should throw other errors', function (done) {
        var replyTo = ctx.message.properties.replyTo
        var corrId = ctx.message.properties.correlationId
        ctx.err = new Error('unexpected')
        ctx.channel.checkQueue.rejects(ctx.err)
        ctx.reply(ctx.connection, ctx.message, ctx.content, ctx.opts)
          .then(function () {
            done(new Error('expected an error'))
          })
          .catch(function (err) {
            expect(err).to.equal(ctx.err)
            expect(err.data).to.deep.equal({
              queue: replyTo,
              correlationId: corrId,
              message: ctx.message,
              content: ctx.content,
              opts: ctx.opts
            })
            done()
          }).catch(done)
      })
    })

    describe('channel error', function () {
      beforeEach(function (done) {
        ctx.connection.createChannel.resolves(ctx.channel)
        ctx.channel.checkQueue.returns(new Promise(function () {}))
        done()
      })

      it('should throw queue 404 error', function (done) {
        var replyTo = ctx.message.properties.replyTo
        var corrId = ctx.message.properties.correlationId
        ctx.err = new Error('Channel closed by server: 404 (NOT-FOUND) with message "NOT_FOUND - no queue \'' + replyTo + '\' in vhost \'/\'"')
        ctx.err.code = 404
        ctx.reply(ctx.connection, ctx.message, ctx.content, ctx.opts)
          .then(function () {
            done(new Error('expected an error'))
          })
          .catch(function (err) {
            expect(err).to.be.an.instanceOf(QueueNotFoundError)
            expect(err.data).to.deep.equal({
              queue: replyTo,
              correlationId: corrId,
              message: ctx.message,
              content: ctx.content,
              opts: ctx.opts,
              err: errToJSON(ctx.err)
            })
            done()
          })
          .catch(done)
        shimmer.wrap(ctx.channel, 'checkQueue', function (orig) {
          return function () {
            ctx.channel.emit('error', ctx.err)
            return orig.apply(this, arguments)
          }
        })
      })

      it('should throwNextTick any other errors', function (done) {
        var throwNextTick = ctx.throwNextTick
        var replyTo = ctx.message.properties.replyTo
        var corrId = ctx.message.properties.correlationId
        ctx.err = new Error('unexpected')
        ctx.reply(ctx.connection, ctx.message, ctx.content, ctx.opts)
          .then(function () {
            done(new Error('expected an error'))
          })
          .catch(function () {
            sinon.assert.calledOnce(throwNextTick)
            var err = throwNextTick.args[0][0]
            expect(err).to.equal(ctx.err)
            expect(err.data).to.deep.equal({
              queue: replyTo,
              correlationId: corrId,
              message: ctx.message,
              content: ctx.content,
              opts: ctx.opts
            })
            done()
          }).catch(done)
        shimmer.wrap(ctx.channel, 'checkQueue', function (orig) {
          return function () {
            ctx.channel.emit('error', ctx.err)
            return orig.apply(this, arguments)
          }
        })
      })
    })

    describe('channel close', function () {
      beforeEach(function (done) {
        ctx.connection.createChannel.resolves(ctx.channel)
        ctx.channel.checkQueue.returns(new Promise(function () {}))
        done()
      })

      it('should throw ChannelCloseError', function (done) {
        var replyTo = ctx.message.properties.replyTo
        var corrId = ctx.message.properties.correlationId
        ctx.reply(ctx.connection, ctx.message, ctx.content, ctx.opts)
          .then(function () {
            done(new Error('expected an error'))
          })
          .catch(function (err) {
            expect(err).to.be.an.instanceOf(ChannelCloseError)
            expect(err.message).to.equal('rpc channel closed before publishing the response message')
            expect(err.data).to.deep.equal({
              queue: replyTo,
              correlationId: corrId,
              message: ctx.message,
              content: ctx.content,
              opts: ctx.opts
            })
            done()
          }).catch(done)
        shimmer.wrap(ctx.channel, 'checkQueue', function (orig) {
          return function () {
            ctx.channel.emit('close')
            return orig.apply(this, arguments)
          }
        })
      })
    })
  })
})
