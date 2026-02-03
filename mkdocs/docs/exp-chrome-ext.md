How It Works

    The extension starts up and initializes Firebase connection

    It registers itself as a "navigator" peer in Firestore using server-side timestamps.

    It periodically queries for available "interface" peers, filtering out those that haven't updated their `lastSeen` timestamp (server-time) in the last ~20 seconds.

    When an interface is found, it initiates a WebRTC connection. It sets up message listeners first to avoid race conditions during the handshake.

    Once connected, it can receive vibration commands through the data channel and send tactile feedback back to the PWA.

    The extension monitors `iceConnectionState` and will automatically attempt to reconnect if the connection is lost.

To use this extension:

    Package these files into a Chrome extension

    Load it in Chrome in developer mode

    The extension will automatically try to connect to any available interface PWA on the same network


   ##  todo:
     bundle firebase scripts