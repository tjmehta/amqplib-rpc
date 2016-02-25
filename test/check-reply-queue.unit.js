var EventEmitter = require('events').EventEmitter

var Code = require('code')
var Connection = require('amqplib/lib/channel_model').ChannelModel
var Lab = require('lab')
// var put = require('101/put')
var proxyquire = require('proxyquire')
var sinon = require('sinon')
require('sinon-as-promised')

var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var expect = Code.expect

describe('checkReplyQueue', function () {
  var ctx
  beforeEach(function (done) {
    ctx = {}
    ctx.ret = {}
    ctx.connection = new Connection(new EventEmitter())
    ctx.message = {
      properties: {
        replyTo: 'reply-to'
      }
    }
    ctx.cb = function () {}
    ctx.checkQueue = sinon.stub().returns(ctx.ret)
    ctx.checkReplyQueue = proxyquire('../lib/check-reply-queue', {
      './check-queue.js': ctx.checkQueue
    })
    done()
  })
  describe('success', function () {
    it('should invoke check queue', function (done) {
      var val = ctx.checkReplyQueue(ctx.connection, ctx.message, ctx.cb)
      sinon.assert.calledOnce(ctx.checkQueue)
      sinon.assert.calledWith(ctx.checkQueue,
        ctx.connection, ctx.message.properties.replyTo, ctx.cb)
      expect(val).to.equal(ctx.ret)
      done()
    })
  })

  describe('error', function () {
    it('should error if no replyTo', function (done) {
      delete ctx.message.properties.replyTo
      expect(function () {
        ctx.checkReplyQueue(ctx.connection, ctx.message, ctx.cb)
      }).to.throw(/'replyTo' is required/)
      done()
    })
  })
})
