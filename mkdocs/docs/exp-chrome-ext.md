How It Works

    The extension starts up and initializes Firebase connection

    It registers itself as a "navigator" peer in Firestore using server-side timestamps.

    It periodically queries for available "interface" peers, filtering out those that haven't updated their `lastSeen` timestamp (server-time) in the last ~20 seconds.

    When an interface is found, it initiates a WebRTC connection. It sets up message listeners first to avoid race conditions during the handshake.

    Once connected, it can receive vibration commands through the data channel and send tactile feedback back to the PWA. It also supports sending arbitrary string messages via a dedicated input field.

    The extension monitors `iceConnectionState` and will automatically attempt to reconnect if the connection is lost.

## Sidebar Interface

The sidebar provides a user-friendly interface to manage the connection and interact with the PWA:

- **Status Indicator**: Shows the current connection state (Connecting, Connected, Waiting, etc.).
- **Message Input**: A text field to type messages to send to the PWA.
- **Send Button**: Sends the message to the PWA via the WebRTC data channel. This button is **dynamically enabled/disabled** based on the connection status.
- **Message Log**: Displays a history of incoming and outgoing messages with timestamps.

## To use this extension:


    Package these files into a Chrome extension

    Load it in Chrome in developer mode

    The extension will automatically try to connect to any available interface PWA on the same network


   ##  todo:
     bundle firebase scripts