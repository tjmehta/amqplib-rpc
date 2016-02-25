var EventEmitter = require('events').EventEmitter

var Channel = require('amqplib/lib/channel_model').Channel
var Code = require('code')
var Connection = require('amqplib/lib/channel_model').ChannelModel
var Lab = require('lab')
// var put = require('101/put')
var proxyquire = require('proxyquire')
var ChannelCloseError = require('../lib/errors/channel-close-error.js')
var shimmer = require('shimmer')
var sinon = require('sinon')
require('sinon-as-promised')

var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var expect = Code.expect

describe('checkQueue', function () {
  var ctx
  var monkeyPatchChannelEvent = function (event, data) {
    shimmer.wrap(ctx.channel, 'checkQueue', function (orig) {
      return function () {
        ctx.channel.emit(event, data)
        return orig.apply(this, arguments)
      }
    })
  }

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
    ctx.queue = 'queue-name'
    ctx.opts = {}
    ctx.throwNextTick = sinon.spy(function (err) {
      throw err
    })
    ctx.first = sinon.spy(require('first-event'))
    // checkQueue
    ctx.checkQueue = proxyquire('../lib/check-queue.js', {
      'throw-next-tick': ctx.throwNextTick,
      'first-event': ctx.first
    })
    done()
  })

  describe('success', function () {
    beforeEach(function (done) {
      ctx.connection.createChannel.resolves(ctx.channel)
      ctx.channel.checkQueue.resolves()
      ctx.channel.close.resolves()
      done()
    })

    describe('promise api', function () {
      it('should check the replyTo queue', function (done) {
        ctx.checkQueue(ctx.connection, ctx.queue).then(function (ret) {
          expect(ret).to.equal(true)
          sinon.assert.calledOnce(ctx.connection.createChannel)
          sinon.assert.calledOnce(ctx.first)
          sinon.assert.calledWith(ctx.first, ctx.channel, ['error', 'close'])
          sinon.assert.calledOnce(ctx.channel.checkQueue)
          sinon.assert.calledWith(ctx.channel.checkQueue, ctx.queue)
          sinon.assert.calledOnce(ctx.channel.close)
          done()
        }).catch(done)
      })
    })

    describe('callback api', function () {
      it('should check if the queue exists', function (done) {
        ctx.checkQueue(ctx.connection, ctx.queue, function (err, ret) {
          expect(ret).to.equal(true)
          expect(err).to.not.exist()
          sinon.assert.calledOnce(ctx.connection.createChannel)
          sinon.assert.calledOnce(ctx.first)
          sinon.assert.calledWith(ctx.first, ctx.channel, ['error', 'close'])
          sinon.assert.calledOnce(ctx.channel.checkQueue)
          sinon.assert.calledWith(ctx.channel.checkQueue, ctx.queue)
          sinon.assert.calledOnce(ctx.channel.close)
          done()
        })
      })
    })
  })

  describe('errors', function () {
    describe('channel events', function () {
      beforeEach(function (done) {
        ctx.connection.createChannel.resolves(ctx.channel)
        ctx.channel.checkQueue.returns(new Promise(function () {})) // wait
        done()
      })

      describe('channel error', function () {
        describe('queue 404 error', function () {
          beforeEach(function (done) {
            ctx.err = new Error(
              'Channel closed by server: 404 (NOT-FOUND) with message "NOT_FOUND - ' +
              'no queue \'' + ctx.queue + '\' in vhost \'/\'"')
            ctx.err.code = 404
            monkeyPatchChannelEvent('error', ctx.err)
            done()
          })

          it('should yield false', function (done) {
            ctx.checkQueue(ctx.connection, ctx.queue).then(function (val) {
              expect(val).to.equal(false)
              done()
            }).catch(done)
          })
        })
        describe('other error', function () {
          beforeEach(function (done) {
            ctx.err = new Error('boom')
            monkeyPatchChannelEvent('error', ctx.err)
            done()
          })

          it('should throwNextTick err', function (done) {
            ctx.checkQueue(ctx.connection, ctx.queue).then(function () {
              done(new Error('expected an error'))
            }).catch(function (err) {
              sinon.assert.calledOnce(ctx.throwNextTick)
              sinon.assert.calledWith(ctx.throwNextTick, err)
              expect(err).to.be.an.instanceOf(Error)
              expect(err.message).to.equal('boom')
              expect(err.data).to.deep.equal({
                queue: ctx.queue
              })
              sinon.assert.notCalled(ctx.channel.close)
              done()
            }).catch(done)
          })
        })
      })

      describe('channel close', function () {
        beforeEach(function (done) {
          ctx.err = new Error('boom')
          monkeyPatchChannelEvent('close')
          done()
        })

        it('should yield ChannelCloseError', function (done) {
          ctx.checkQueue(ctx.connection, ctx.queue).then(function () {
            done(new Error('expected an error'))
          }).catch(function (err) {
            expect(err).to.exist()
            expect(err).to.be.an.instanceOf(ChannelCloseError)
            expect(err.message).to.equal('channel closed before checking the queue\'s existance')
            expect(err.data).to.deep.equal({
              queue: ctx.queue
            })
            sinon.assert.notCalled(ctx.channel.close)
            done()
          }).catch(done)
        })
      })
    })

    describe('checkQueue error', function () {
      beforeEach(function (done) {
        ctx.connection.createChannel.resolves(ctx.channel)
        ctx.err = new Error('boom')
        ctx.channel.checkQueue.rejects(ctx.err)
        ctx.channel.close.resolves()
        done()
      })

      it('should yield err', function (done) {
        ctx.checkQueue(ctx.connection, ctx.queue).then(function () {
          done(new Error('expected an error'))
        }).catch(function (err) {
          expect(err).to.exist()
          expect(err).to.be.an.instanceOf(Error)
          expect(err.message).to.equal('boom')
          expect(err.data).to.deep.equal({
            queue: ctx.queue
          })
          sinon.assert.calledOnce(ctx.channel.close)
          done()
        }).catch(done)
      })
    })
  })
})
