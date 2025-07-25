How It Works

    The extension starts up and initializes Firebase connection

    It registers itself as a "navigator" peer in Firestore

    It periodically checks for available "interface" peers

    When an interface is found, it initiates a WebRTC connection

    Once connected, it can receive vibration commands through the data channel

To use this extension:

    Package these files into a Chrome extension

    Load it in Chrome in developer mode

    The extension will automatically try to connect to any available interface PWA on the same network