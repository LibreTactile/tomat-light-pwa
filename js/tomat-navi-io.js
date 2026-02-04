/**
 * TomatNaviIO - Handles WebRTC communication for button interactions
 * Specifically for reporting button up/down events to the navigator.
 */

class TomatNaviIO {
    constructor(webrtcManager) {
        this.webrtcManager = webrtcManager;
    }

    /**
     * Report a button interaction to the connected peer
     * @param {string} input - The input identifier (e.g., 'h1', 'enter', 'F')
     * @param {string} state - Interaction state: 'down' or 'up'
     * @param {string|number} row - Optional row number (1-4) for row buttons
     */
    handleButtonInteraction(input, state, row = null) {
        // Only send if there is an active connection
        if (!this.webrtcManager || !this.webrtcManager.isConnected) {
            return;
        }

        // Map state to character (D=Down, U=Up)
        const stateChar = state === 'down' ? 'D' : 'U';
        let message = null;

        // Check for 'enter' button (uses row number)
        if (input === 'enter' && row) {
            message = `B${row}${stateChar}*`;
        }
        // Check for navigation buttons (uses input char)
        // Nav inputs: F, P, M, U, D, N
        else if (['F', 'P', 'M', 'U', 'D', 'N'].includes(input)) {
            message = `B${input}${stateChar}*`;
        }

        if (message) {
            Utils.log(`TomatNaviIO: Sending ${message} (${state} for ${input})`);
            this.webrtcManager.sendData(message);
        }
    }
}
