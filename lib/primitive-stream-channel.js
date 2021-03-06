
'use strict'

var object = require('quiver-object')

var createPrimitiveStreamChannel = function() {
  var readStream = object.createSingleOwnershipObject()
  var writeStream = object.createSingleOwnershipObject()

  var mStreamClosed = null

  var mReadCallback = null
  var mWriteCallback = null

  var mStreamInProgress = false

  var dispatchCallback = function() {
    mStreamInProgress = true
    var writerCalled = false

    var writer = function(writeClosed, buffer) {
      if(writerCalled) throw new Error('writer can only be called once')

      writerCalled = true

      if(!writeClosed && !buffer) throw new Error(
        'Must supply either writeClosed or buffer')

      if(writeClosed && buffer) throw new Error(
        'You may not supply a buffer while close the stream at the same time')

      if(writeClosed && !mStreamClosed) mStreamClosed = writeClosed

      process.nextTick(function() {
        mStreamInProgress = false
        var readCallback = mReadCallback
        mReadCallback = null

        readCallback(writeClosed, buffer)
      })
    }

    process.nextTick(function() {
      var writeCallback = mWriteCallback
      mWriteCallback = null

      writeCallback(null, writer)
    })
  }

  var dispatchIfReady = function() {
    if(mWriteCallback && mReadCallback && !mStreamInProgress) {
      dispatchCallback()
    }
  }

  var notifyStreamClosed = function(callback) {
    process.nextTick(function() {
      mStreamInProgress = false
      mReadCallback = null
      mWriteCallback = null

      callback(mStreamClosed)
    })
  }

  readStream.read = function(callback) {
    if(mReadCallback || mStreamInProgress) throw new Error(
      'read called multiple times without waiting for callback')

    mReadCallback = callback
    if(mStreamClosed) {
      notifyStreamClosed(callback)
    } else {
      dispatchIfReady()
    }
  }

  readStream.closeRead = function(err) {
    if(mReadCallback) throw new Error(
      'cannot close read stream before read callback is completed')

    if(mStreamClosed) return
    mStreamClosed = { err: err }

    if(mWriteCallback && !mStreamInProgress) {
      notifyStreamClosed(mWriteCallback)
    }
  }

  writeStream.prepareWrite = function(callback) {
    if(mWriteCallback) throw new Error(
      'prepareWrite called multiple times without waiting for callback')

    mWriteCallback = callback
    if(mStreamClosed) {
      notifyStreamClosed(callback)
    } else {
      dispatchIfReady()
    }
  }

  writeStream.closeWrite = function(err) {
    if(mWriteCallback) throw new Error(
      'cannot close write stream before write callback is completed')

    if(mStreamClosed) return
    mStreamClosed = { err: err }

    if(mReadCallback && !mStreamInProgress) {
      notifyStreamClosed(mReadCallback)
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
