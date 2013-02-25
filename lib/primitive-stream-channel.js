
var object = require('quiver-object')

var createPrimitiveStreamChannel = function() {
  var readStream = object.createSingleOwnershipObject()
  var writeStream = object.createSingleOwnershipObject()

  var streamClosed = null

  var readCallback = null
  var writeCallback = null

  var streamInProgress = false

  var dispatchCallback = function() {
    streamInProgress = true
    var writerCalled = false

    var writer = function(writeClosed, buffer) {
      if(writerCalled) throw new Error('writer can only be called once')
      if(writeClosed) {
        if(!streamClosed) streamClosed = writeClosed
        if(buffer != null && buffer != undefined) throw new Error(
          'You may not supply a buffer while close the stream at the same time')
      }

      process.nextTick(function() {
        streamInProgress = false
        var _readCallback = readCallback
        readCallback = null

        _readCallback(writeClosed, buffer)
      })
    }

    process.nextTick(function() {
      var _writeCallback = writeCallback
      writeCallback = null

      _writeCallback(null, writer)
    })
  }

  var dispatchIfReady = function() {
    if(writeCallback && readCallback && !streamInProgress) {
      dispatchCallback()
    }
  }

  var notifyStreamClosed = function(callback) {
    process.nextTick(function() {
      streamInProgress = false
      readCallback = null
      writeCallback = null

      callback(streamClosed)
    })
  }

  readStream.read = function(callback) {
    if(readCallback || streamInProgress) throw new Error(
      'read called multiple times without waiting for callback')

    readCallback = callback
    if(streamClosed) {
      notifyStreamClosed(callback)
    } else {
      dispatchIfReady()
    }
  }

  readStream.closeRead = function(err) {
    if(readCallback) throw new Error(
      'cannot close read stream before read callback is completed')

    if(streamClosed) return
    streamClosed = { err: err }

    if(writeCallback && !streamInProgress) {
      notifyStreamClosed(writeCallback)
    }
  }

  writeStream.prepareWrite = function(callback) {
    if(writeCallback) throw new Error(
      'prepareWrite called multiple times without waiting for callback')

    writeCallback = callback
    if(streamClosed) {
      notifyStreamClosed(callback)
    } else {
      dispatchIfReady()
    }
  }

  writeStream.closeWrite = function(err) {
    if(writeCallback) throw new Error(
      'cannot close write stream before write callback is completed')

    if(streamClosed) return
    streamClosed = { err: err }

    if(readCallback && !streamInProgress) {
      notifyStreamClosed(readCallback)
    }
  }

  var channel = {
    writeStream: writeStream,
    readStream: readStream
  }

  return channel
}

module.exports = {
  createPrimitiveStreamChannel: createPrimitiveStreamChannel
}
