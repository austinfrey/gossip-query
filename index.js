//1 user request

/*
  queried (check local cache) ->
  requests (broadcast to select peers) ->
  received (received requests) ->
  results (respond to any current queries)
*/

var STATES = {
  queried: 1,
  checking: 2,
  checked: 3,
  requesting: 4,
  requested: 5,
  processing: 6,
  processed: 7,
  ready: 8
}

module.exports = function (opts) {
  //opts has {check, process, isQuery, isResponse}
  var state = {}
  var localCbs = {}

  var initialWeight = opts.initialWeight || -1
  var increase = opts.increase || function (n) { return Number(n) + 1 }
  var isRequest = opts.isRequest || function (value) { return typeof value === 'number' && value < 0 }
  var isResponse = opts.isResponse || function (value) { return !isRequest(value) }

  function next () {
    throw new Error('not yet implemented')
  }

  function onUpdate () {
    for(var k in state) {
      //check the local store when new queries are added
      if(!state[k].checked && !state[k].checking) {
        state[k].checking = true
        opts.check(k, function (err, value) {
          if(err) console.trace(err) // TODO: delete or reject query?
          state[k].checking = false
          state[k].checked = true
          if(value && !state[k].value) {
            state[k].value = value
          }
        })
      }

      //process items received
      if(state[k].value != null && !state[k].processing && !state[k].ready) {
        state[k].processing = true
        opts.process(k, state[k].value, function (err, value) {
          if(err) console.trace(err) // TODO: reject query?
          state[k].processing = false
          state[k].ready = true
          if(value && !state[k].value) {
            state[k].value = value
            var cbs = localCbs[k]
            if (cbs) {
              delete localCbs[k]
              while (cbs.length) cbs.shift()(null, value)
            }
          }
        })
      }
    }
  }

  function initial (weight) {
    return {
      ready: false,
      checked: false,
      checking: false,
      weight: weight,
      value: null,
      requestedBy: {},
      requestedFrom: {},
      respondedTo: {}
    }
  }

  return {
    state: state,
    createStream: function (peerId) {
      return {
        source: function (end, cb) {
          if(end) {
            if(end !== true) console.trace(peerId, end)
            for(var k in state) {
              // TODO: use hashlru so we don't have to use delete
              delete state[k].respondedTo[peerId]
              delete state[k].requestedFrom[peerId]
            }
            return
          }
          //read the next pieces of data from the state object.
          ;(function read () {
            var data = {}
            for(var k in state) {
              if(
                //ready means it's been processed,
                //or we already had it locally (TODO).
                state[k].ready &&
                state[k].requestedBy[peerId] &&
                !state[k].respondedTo[peerId]
              ) {
                state[k].respondedTo[peerId] = true
                data[k] = state[k].value
              }
              else if(
                !state[k].ready &&
                state[k].checked &&
                !state[k].requestedFrom[peerId]
              ) {
                state[k].requestedFrom[peerId] = true
                data[k] = state[k].weight //the number of hops, etc
              }
            }
            //next(read) calls read again when something changes in the state.
            if(isEmpty(data)) next(read)
            else cb(null, data)
          })()
        },
        sink: function (read) {
          read(null, function more (end, data) {
            if(end) {
              if(end !== true) console.trace(peerId, end)
              for(var k in state) {
                delete state[k].requestedBy[peerId]
              }
              //Q: how does the source decide to end?
              //A: the network connection aborts the stream.
              return
            }
            //process this message and possibly update the state.
            var update = false
            for(var k in data) {
              if(isRequest(data[k])) {
                //if we already have seen this query:
                update = true
                if(state[k]) {
                  state[k].requestedBy[peerId] = true
                }
                else {
                  state[k] = initial(data[k])
                  state[k].requestedBy[peerId] = true
                }
              }
              else if(isResponse(data[k])) {
                //if this is a response,
                state[k].value = data[k]
                update = true
              }
            }
            if(update) next()
            read(null, more)
          })
        }
      }
    },

    query: function (query, cb) {
      //add to state object and update
      if(state[k]) {
        if(state[k].ready) {
          cb(null, state[k].value)
        }
        else {
          localCbs[k].push(cb)
        }
      }
      else {
        update = true
        state[k] = initial(initialWeight)
        localCbs[k] = [cb]
      }
      if(update) next()
    }
  }
}


