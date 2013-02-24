
var vows = require('vows')
var assert = require('assert')
var createChannel = require('../lib/primitive-stream-channel').createPrimitiveStreamChannel

var guardCallback = function(callback) {
  var called = false
  return function() {
    if(called) throw new Error('callback is called multiple times')
    callback.apply(null, arguments)
  }
}

vows.describe('different correct read write sequences')
.addBatch(
{
  'read write write read read closeWrite': {
    topic: function() {
      var callback = this.callback

      var channel = createChannel()
      var readStream = channel.readStream
      var writeStream = channel.writeStream

      var firstData = 'foo'
      var secondData = 'bar'
      var closeErr = 'error'

      // 1
      readStream.read(guardCallback(function(streamClosed, data) {
        assert.isNull(streamClosed)
        assert.equal(data, firstData)

        // 3
        writeStream.prepareWrite(guardCallback(function(streamClosed, writer) {
          assert.isNull(streamClosed)
          assert.isFunction(writer)

          writer(null, secondData)
        }))

        // 4
        readStream.read(guardCallback(function(streamClosed, data) {
          assert.isNull(streamClosed)
          assert.equal(data, secondData)

          // 5
          readStream.read(guardCallback(function(streamClosed, data) {
            assert.isObject(streamClosed)
            assert.equal(streamClosed.err, closeErr)
            assert.isUndefined(data)

            callback(null)
          }))

          // 6
          writeStream.closeWrite(closeErr)
        }))
      }))

      // 2
      writeStream.prepareWrite(guardCallback(function(streamClosed, writer) {
        assert.isNull(streamClosed)
        assert.isFunction(writer)

        writer(null, firstData)
      }))
    },
    'should success': function() { }
  },

  'write read read write closeRead write': {
    topic: function() {
      var callback = this.callback

      var channel = createChannel()
      var readStream = channel.readStream
      var writeStream = channel.writeStream

      var firstData = 'foo'
      var secondData = 'bar'
      var closeErr = 'error'

      // 1
      writeStream.prepareWrite(guardCallback(function(streamClosed, writer) {
        assert.isNull(streamClosed)
        assert.isFunction(writer)

        writer(null, firstData)
      }))

      // 2
      readStream.read(guardCallback(function(streamClosed, data) {
        assert.isNull(streamClosed)
        assert.equal(data, firstData)

        // 3
        readStream.read(guardCallback(function(streamClosed, data) {
          assert.isNull(streamClosed)
          assert.equal(data, secondData)

          // 5
          readStream.closeRead(closeErr)

          // 6
          writeStream.prepareWrite(guardCallback(function(streamClosed, writer) {
            assert.isObject(streamClosed)
            assert.equal(streamClosed.err, closeErr)
            assert.isUndefined(writer)

            callback(null)
          }))
        }))

        // 4
        writeStream.prepareWrite(guardCallback(function(streamClosed, writer) {
          assert.isNull(streamClosed)
          assert.isFunction(writer)

          writer(null, secondData)
        }))
      }))

    },
    'should success': function() { }
  },
})
.export(module)


vows.describe('inconsistent states').addBatch({
  'when read is called twice': 
  {  
    topic: createChannel(),
    'exception is thrown the second time': function(channel) {
      var readStream = channel.readStream

      assert.doesNotThrow(function() {
        readStream.read(function(streamClosed, buffer) {
          assert.isTrue(false)
        })
      })

      assert.throws(function() {
        readStream.read(function(streamClosed, buffer) {
          assert.isTrue(false)
        })
      })
    }
  }
})
.export(module)


var createCloseWriteTestCase = function(channel) {
  return {
    topic: function() {
      var callback = this.callback
      channel.readStream.read(callback)
      channel.writeStream.closeWrite(null)
    },
    'stream should be closed here': function(streamClosed, data) {
      assert.isObject(streamClosed)
      assert.isUndefined(data)
    }
  }
}

var createCloseReadTestCase = function(channel) {
  return {
    topic: function() {
      var callback = this.callback
      channel.readStream.closeRead(null)
      channel.writeStream.prepareWrite(callback)
    },
    'stream should be closed here': function(streamClosed, writer) {
      console.log(streamClosed)
      assert.isObject(streamClosed)
      assert.isUndefined(writer)
    }
  }
}

var createNormalReadWriteTestCase = function(channel, writeFirst, innerTestCase) {
  var onRead = function() {
    throw new Error('read callback should not be called yet')
  }

  return {
    topic: function() {
      var callback = this.callback

      if(writeFirst) {
        channel.writeStream.prepareWrite(callback)
      }

      channel.readStream.read(function(streamClosed, data) {
        onRead(streamClosed, data)
      })

      if(!writeFirst) {
        channel.writeStream.prepareWrite(callback)
      }
    },

    'write callback should receive a writer': function(streamClosed, writer) {
      assert.isNull(streamClosed)
      assert.isFunction(writer)
    },

    'when write callback write to the writer': {
      topic: function(writer) {
        onRead = this.callback
        writer(null, 'test')
      },
      'read callback should receive the data': function(streamClosed, data) {
        assert.isNull(streamClosed)
        assert.equal(data, 'test')
      },
      'if we continue writing or close here': innerTestCase
    }
  }
}

var channel = createChannel()
var normalReadWriteTestCase = createNormalReadWriteTestCase(channel, true, 
  createNormalReadWriteTestCase(channel, true, createCloseWriteTestCase(channel)))

vows.describe('normal read write').addBatch(
{
  'when both read and write are called': normalReadWriteTestCase
})
.export(module)
