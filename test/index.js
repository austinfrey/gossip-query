var GossipQuery = require('../')
var pull = require('pull-stream')

var tape = require('tape')

function GQ (store) {
  return GossipQuery({
    check: function (key, cb) { cb(null, store[key]) },
    process: function (key, value, cb) { cb(null, value) },
    isQuery: function (key) { return true },
    isResponse: function (value) { return null != value  }
  })
}

/*
all these tests are sync, because it makes it really
easy to reason about the ordering of events and
produce correct tests
*/

tape('simple', function (t) {
  var gq = GQ({query: true})
  gq.query('query', function (err, value) {
    t.equal(value, true)
    t.notOk(err)
    t.end()
  })
})

tape('stream: send request', function (t) {
  var gq = GQ({}), _value
  gq.query('query', function (err, value) {
    _value = value
  })
  t.notOk(_value)

  var stream = gq.createStream(), a = [], read_cb

  stream.sink(function (_, cb) {
    read_cb = cb
  })

  stream.source(null, function (err, msg) {
    if(err) throw err
    t.deepEqual(msg, {query: -1})
    read_cb(null, {query: 'result'})
    t.equal(_value, 'result')
    t.end()
  })

})

tape('stream: send response', function (t) {
  var gq = GQ({foo: 'bar'})
  var stream = gq.createStream(), read_cb

  stream.sink(function (_, cb) {
    read_cb = cb
  })

  //send a request
  read_cb(null, {foo: -1})

  stream.source(null, function (err, msg) {
    if(err) throw err
    t.deepEqual(msg, {foo: 'bar'})
    t.end()
  })

})

tape('stream: broadcast request', function (t) {
  var gq = GQ({})
  var stream1 = gq.createStream(), read_cb1

  stream1.sink(function (_, cb) {
    read_cb1 = cb
  })

  var stream2 = gq.createStream(), read_cb2

  stream2.sink(function (_, cb) {
    read_cb2 = cb
  })

  //send a request
  read_cb1(null, {foo: -1})

  stream2.source(null, function (err, msg) {
    if(err) throw err
    t.deepEqual(msg, {foo: -2})
    //then send a response...
    read_cb2(null, {foo: 'bar'})
  })

  //response should make it back to stream1
  stream1.source(null, function (err, msg) {
    t.deepEqual(msg, {foo: 'bar'})
    t.end()
  })

})

