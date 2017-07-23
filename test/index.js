
// this isn't the real tests yet
// but i'm practicing how you could test something
// like this (deterministically).

var tape = require('tape')

var K = 0

var network = {}

function peer () {
  ++K
  return network[K] = {
    id: K,
    input: [],
    state: {},
    peers: {}
  }
}

function connect (a, b) {
  a.peers[b.id] = true
  b.peers[a.id] = true
}

function evolve(network, has, work) {
  var A = 0
  var loop = true
  while (loop) {
    loop = false
    var events = []
    for(var k in network) {
      var peer = network[k]
      if(has(peer))
        events.push(peer)
    }
    //randomly select a action and do it.
    var next = events[~~(Math.random()*events.length)]
    loop = !!events.length
    if(next) {
      A++
      work(next)
    }
  }
  return A
}

function has (peer) {
  return peer.input.length
}

//broadcast to peers, except the one you received the message from.
function work (peer) {
  var data = peer.input.shift()
  if(!data) throw new Error('expected message')
  //do not forward if we have already seen this message
  if(peer.state[data.value]) return

  peer.state[data.value] = true
  for(var k in peer.peers) {
    if(+k !== data.key) {
      console.log(peer.id,'->',k, {value: data.value, key: peer.id})
      network[k].input.push({value: data.value, key: peer.id})
    }
  }
}

tape('ring', function (t) {
  network = {}
  var a = peer()
  var b = peer()
  var c = peer()

  connect(a, b); connect(b, c); connect(c, a)

  //a spontaniously (user input) decides to broadcast "foo"
  a.input.push({value:'foo', key: 0})

  var A = evolve(network, has, work)

  t.equal(A, 5) //5 messages moved initial, + 4 passes to a peer.

  for(var k in network)
    t.ok(network[k].state.foo)

  t.end()

})
//and then verify that everyone received the message.

tape('chain', function (t) {
  network = {}
  var a = peer()
  var b = peer()
  var c = peer()

  connect(a, b); connect(b, c)

  //a spontaniously (user input) decides to broadcast "foo"
  a.input.push({value:'foo', key: 0})

  var A = evolve(network, has, work)

  t.equal(A, 3) //5 messages moved initial, + 4 passes to a peer.

  for(var k in network)
    t.ok(network[k].state.foo)

  t.end()

})
//and then verify that everyone received the message.

function random (n, create, pair) {
  var first = create()
  var peers = [first]
  while(--n) {
    var newest = create()
    pair(newest, peers[~~(Math.random()*peers.length)])
    peers.push(newest)
  }
  return first
}

tape('random', function (t) {
  network = {}
  //generate a random connected network
  var a = random(7, peer, connect)
  console.log(network)
  a.input.push({value:'foo', key: 0})

  var A = evolve(network, has, work)

  t.ok(A >= 7, A+' >= 7') //5 messages moved initial, + 4 passes to a peer.
  t.ok(A < 7*2-1) //5 messages moved initial, + 4 passes to a peer.

  for(var k in network)
    t.ok(network[k].state.foo, 'peer'+k+' has foo')

  t.end()
})


function clique (n, create, pair) {
  var peers = []
  for(var i = 0;i < n; i++) {
    peers.push(create())
    for(var j = 0; j < i; j++)
      pair(peers[i], peers[j])
  }
  return peers[0]
}

tape('fully connected', function (t) {
  network = {}
  var a = clique(4, peer, connect)
  console.log(network)
  a.input.push({value:'foo', key: 0})

  var A = evolve(network, has, work)

  t.equal(A, 4)
  t.end()
})

