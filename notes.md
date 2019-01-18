// test what you've made so far in the console

polylab.amp({gain: 0.1})   // create an amplifier (node 0) with max gain of 10%
nodes[0].outs.push(-1)     // this is the same as saying amp.connect(audioCtx.destination) -- sends signal to speakers
polylab.osc()              // create an oscillator (node 1)
nodes[1].type = 'sawtooth' // change the osc's waveform
nodes[1].outs.push(0)      // connect the oscillator to the amp so we hear its waveform
polylab.ctrl()             // create a MIDI controller (node 2)
nodes[2].outs.push(1)      // connect the MIDI controller to the oscillator to control its pitch
polylab.env()              // create an ADSR envelope (node 3)
nodes[3].outs.push(0)      // connect the env to the amplifier to control its gain
nodes[2].outs.push(3)      // connect the controller to the envelope to trigger it starting (ADS) and stopping (R)
reconnectNodes();          // loops through the outs of each node, and both node & out are connectable, call connect
