Here is how you can host the PWA locally and test it on your phone:

1. Start a Local Server
Since you have Python installed, the easiest way is to run this command in your terminal while in the tomat-light-pwa directory:

```bash
python3 -m http.server 8000
```

2. Connect from your Phone
To access it, you need your computer's local IP address. I found it for you: 192.168.X.X.

Open your phone's browser and go to: http://192.168.X.X:8000

⚠️ Critical Note for PWAs
PWAs (Service Workers) require a Secure Context (HTTPS) to work fully. They will fail on http://192.168....

To test the Service Worker/Installability on your phone, use Chrome Port Forwarding (Best Method):

- Connect your Android phone to PC via USB.
- On PC, open Chrome and go to chrome://inspect/#devices.
- Check "Enable Port Forwarding".
- Add a rule: 8000 -> localhost:8000.
- On your phone, visit http://localhost:8000.

    - This tricks the phone into thinking it's a secure local connection, enabling Service Workers!

---

To smooth out reloading while developing:

While your phone is connected and you have chrome://inspect/#devices open:

- On your PC, click inspect under your phone's tab to open a dedicated DevTools window for your phone's browser.

- Go to the Application tab at the top.

- On the left sidebar, click Service Workers.

- Check the box that says Update on reload.

    - What this does: Every time you hit refresh on your phone, it forces the Service Worker to go to your Python server and grab the newest files.