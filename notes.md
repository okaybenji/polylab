// testing
polylab.amp() // nodes[0]
nodes[0].connect(audioCtx.destination)
polylab.osc() // nodes[1]
nodes[1].type = 'sawtooth'
nodes[1].connect(nodes[0])
polylab.ctrl() // nodes[2]
nodes[2].out.push(nodes[1].id)
