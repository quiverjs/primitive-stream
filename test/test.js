
var should = require('should')
var createChannel = require('../lib/primitive-stream-channel').createPrimitiveStreamChannel

var guardCallback = function(callback) {
  var called = false
  return function() {
    if(called) throw new Error('callback is called multiple times')
    callback.apply(null, arguments)
  }
}

describe('different correct read write sequences', function() {
  it('read write write read read closeWrite', function(callback) {
    var channel = createChannel()
    var readStream = channel.readStream
    var writeStream = channel.writeStream

    var firstData = 'foo'
    var secondData = 'bar'
    var closeErr = 'error'

    // 1
    readStream.read(guardCallback(function(streamClosed, data) {
      should.not.exist(streamClosed)
      data.should.equal(firstData)

      // 3
      writeStream.prepareWrite(guardCallback(function(streamClosed, writer) {
        should.not.exist(streamClosed)
        writer.should.be.a('function')

        writer(null, secondData)
      }))

      // 4
      readStream.read(guardCallback(function(streamClosed, data) {
        should.not.exist(streamClosed)
        data.should.equal(secondData)

        // 5
        readStream.read(guardCallback(function(streamClosed, data) {
          should.exist(streamClosed)
          streamClosed.err.should.equal(closeErr)
          should.not.exist(data)

          callback(null)
        }))

        // 6
        writeStream.closeWrite(closeErr)
      }))
    }))

    // 2
    writeStream.prepareWrite(guardCallback(function(streamClosed, writer) {
      should.not.exist(streamClosed)
      writer.should.be.a('function')

      writer(null, firstData)
    }))
  })

  it('write read read write closeRead write', function(callback) {
    var channel = createChannel()
    var readStream = channel.readStream
    var writeStream = channel.writeStream

    var firstData = 'foo'
    var secondData = 'bar'
    var closeErr = 'error'

    // 1
    writeStream.prepareWrite(guardCallback(function(streamClosed, writer) {
      should.not.exist(streamClosed)
      writer.should.be.a('function')

      writer(null, firstData)
    }))

    // 2
    readStream.read(guardCallback(function(streamClosed, data) {
      should.not.exist(streamClosed)
      data.should.equal(firstData)

      // 3
      readStream.read(guardCallback(function(streamClosed, data) {
        should.not.exist(streamClosed)
        data.should.equal(secondData)

        // 5
        readStream.closeRead(closeErr)

        // 6
        writeStream.prepareWrite(guardCallback(function(streamClosed, writer) {
          should.exist(streamClosed)
          streamClosed.err.should.equal(closeErr)
          should.not.exist(writer)
          
          callback(null)
        }))
      }))

      // 4
      writeStream.prepareWrite(guardCallback(function(streamClosed, writer) {
        should.not.exist(streamClosed)
        writer.should.be.a('function')

        writer(null, secondData)
      }))
    }))
  })
})

describe('inconsistent states', function() {
  it('when read is called twice', function() {
    var channel = createChannel()
    var readStream = channel.readStream
    ;(function() {
      readStream.read(function(streamClosed, buffer) {
        should.fail()
      })
    }).should.not.throw()

    ;(function() {
      readStream.read(function(streamClosed, buffer) {
        should.fail()
      })
    }).should.throw()
  })
})
