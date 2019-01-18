let id = 0; // Used to assign a unique identifier to each node.
const nodes = {}; // {id: node}
const controllers = []; // Used to ensure MIDI messages get passed along to each controller.

// TODO: Each time outs are updated, loop through each and connect them to their outs.
const reconnectNodes = () => {
  Object.values(nodes).forEach((node) => {
    if (node.disconnect) {
      node.disconnect();
    }
    if (node.connect) {
      node.outs.forEach(o => node.connect(nodes[o] && nodes[o].connect ? nodes[o] : audioCtx.destination));
    }
  });
};

const Polylab = (audioCtx) => {
  navigator.requestMIDIAccess()
    .then((midi) => {
      const handleMsg = (msg) => {
        controllers.forEach(c => c.msg(msg));
      };

      for (const input of midi.inputs.values()) {
        input.onmidimessage = handleMsg;
      }

      midi.onstatechange = () => console.log(`${midi.inputs.size} MIDI device(s) connected`);
    }, () => {
      console.log('Failed to access MIDI');
    });

  // Creates a node utilizing an existing method in the AudioContext API.
  const createNode = (method) => {
    const node = audioCtx[method]();
    node.outs = []; // Array of IDs of destination nodes for this node. (Eventually should be object w/ ID and prop.)
    nodes[id++] = node;
    return node;
  };

  // Get the current time, and cancel scheduled values.
  const getNow = () => {
    var now = audioCtx.currentTime;
    synth.amp.gain.cancelScheduledValues(now);
    synth.amp.gain.setValueAtTime(synth.amp.gain.value, now);
    return now;
  }

  return {
    amp({gain = 0.9} = {}) {
      const amp = createNode('createGain');
      amp.max = gain;
      amp.gain.setValueAtTime(gain, audioCtx.currentTime);

      return amp;
    },
    cut: ({freq = 7500} = {}) => ({id: id++, max: freq}),
    filter: () => createNode('createBiquadFilter'),
    pan: () => createNode('createPanner'),
    osc() {
      const osc = createNode('createOscillator');
      osc.start();
      return osc;
    },
    // AD & R in seconds; S out of 1.
    env({attack = 0.2, decay = 0.2, sustain = 0.4, release = 0.2} = {}) {
      const _id = id++;
      const outs = [];
      const prop = 'gain'; // For now, controlling just gain of amps.

      const triggerAttack = () => {
        const dests = outs.map(id => nodes[id]);
        dests.forEach((dest) => {
          dest[prop].cancelScheduledValues(audioCtx.currentTime);
          dest[prop].setValueAtTime(dest[prop].value, audioCtx.currentTime);
          dest[prop].linearRampToValueAtTime(dest.max, audioCtx.currentTime + parseFloat(attack));
          // TODO: Can I delay this until above ramp completes?
          // (Need to do this in submono as well)
          dest[prop].linearRampToValueAtTime(sustain * dest.max, audioCtx.currentTime + attack + decay);
        });
      };

      const triggerRelease = () => {
        const dests = outs.map(id => nodes[id]);
        dests.forEach((dest) => {
          dest[prop].cancelScheduledValues(audioCtx.currentTime);
          dest[prop].setValueAtTime(dest[prop].value, audioCtx.currentTime);
          dest[prop].linearRampToValueAtTime(0, audioCtx.currentTime + parseFloat(release));
        });
      };

      const env = {id: _id, attack, decay, sustain, release, triggerAttack, triggerRelease, outs};
      nodes[_id] = env;
      return env;
    },
    ctrl() {
      const _id = id++;
      const outs = []; // Array of IDs of nodes this controller controls.
      const prop = 'frequency'; // For now, controlling just frequency of oscillators.

      const handleMsg = (msg) => {
        const dests = outs.map(id => nodes[id]);
        const [cmd, , val] = msg.data;
        const round = val => val.toFixed(2);
        const frequency = note => Math.pow(2, (note - 69) / 12) * 440;
        const normalize = val => val / 127;
        // Command range represents 16 channels
        const command =
          cmd >= 128 && cmd < 144 ? 'off'
          : cmd >= 144 && cmd < 160 && val === 0 ? 'off'
          : cmd >= 144 && cmd < 160 ? 'on'
          : cmd >= 224 && cmd < 240 ? 'pitch'
          : cmd >= 176 && cmd < 192 ? 'ctrl'
          : 'unknown';

        const exec = {
          off() {
            const [, note, velocity] = msg.data;
            dests.forEach(d => d.triggerRelease && d.triggerRelease());
            console.log(`${command} ${note}`);
          },
          on() {
            const [, note, velocity] = msg.data;
            dests.forEach(d => {
              d[prop] ? d[prop].setValueAtTime(frequency(note), audioCtx.currentTime)
              : d.triggerAttack ? d.triggerAttack()
              : null;
            });
            // TODO: Handle velocity
            console.log(`${command} ${note} ${round(normalize(velocity) * 100)}%`);
          },
          pitch() {
            const [, , strength] = msg.data;
            const mappedStrength = scale(strength, 0, 127, -1, 1) * settings.bendRange / 12;
            const multiplier = Math.pow(2, mappedStrength);

            // TODO...
            console.log(`pitch bend ${strength}`);
          },
          ctrl() {
            // Controllers such as mod wheel, aftertouch, breath add vibrato.
            const [, , strength] = msg.data;
            // TODO...
            console.log(`mod wheel ${strength}`);
          },
          unknown() {
            console.log(msg.data);
          }
        };

        exec[command]();
      };

      const ctrl = {id: _id, msg: handleMsg, outs};
      nodes[_id] = ctrl;
      controllers.push(ctrl);

      return ctrl;
    },
  };
};
