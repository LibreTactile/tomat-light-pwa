/**
 * TomatNaviIO - Handles WebRTC communication for button interactions
 * and manages button states with vibration feedback.
 */

class TomatNaviIO {
    constructor(webrtcManager, vibrationHandler = null) {
        this.webrtcManager = webrtcManager;
        this.vibrationHandler = vibrationHandler;

        // Button state storage - ONLY for h1-h4 buttons
        // Structure: { row: { buttonIndex: 'STATE' } }
        // States: 'INACTIVE', 'ACTIVE', 'PULSATING'
        // Note: enter and navigation buttons do NOT have state management
        this.buttonStates = {
            1: { 0: 'INACTIVE', 1: 'INACTIVE', 2: 'INACTIVE', 3: 'INACTIVE' },
            2: { 0: 'INACTIVE', 1: 'INACTIVE', 2: 'INACTIVE', 3: 'INACTIVE' },
            3: { 0: 'INACTIVE', 1: 'INACTIVE', 2: 'INACTIVE', 3: 'INACTIVE' },
            4: { 0: 'INACTIVE', 1: 'INACTIVE', 2: 'INACTIVE', 3: 'INACTIVE' }
        };
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

    /**
     * Handle state update messages from navigator
     * @param {Object} stateData - JSON object with state updates
     * Example: { rows: [{ row: 1, state: "INACTIVE" }, { row: 2, buttons: [...] }] }
     * Note: Both row numbers and button IDs are 1-based (row: 1-4, id: 1-4)
     */
    handleStateUpdate(stateData) {
        if (!stateData || !stateData.rows) {
            Utils.log('TomatNaviIO: Invalid state update data');
            return;
        }

        // Reset all buttons to INACTIVE before applying new states
        this.resetAllStates();

        for (const rowUpdate of stateData.rows) {
            const rowNumber = rowUpdate.row; // Already 1-based (1-4)

            if (rowNumber < 1 || rowNumber > 4) {
                Utils.log(`TomatNaviIO: Invalid row number ${rowNumber}`);
                continue;
            }

            // Row-level state update (all h1-h4 buttons in row)
            if (rowUpdate.state && !rowUpdate.buttons) {
                this.setRowState(rowNumber, rowUpdate.state);
            }
            // Individual button state updates
            else if (rowUpdate.buttons && Array.isArray(rowUpdate.buttons)) {
                for (const buttonUpdate of rowUpdate.buttons) {
                    // Convert 1-based button ID (1-4) to 0-based index (0-3)
                    const buttonIndex = buttonUpdate.id - 1;
                    if (buttonIndex >= 0 && buttonIndex < 4) {
                        this.setButtonState(rowNumber, buttonIndex, buttonUpdate.state);
                    } else {
                        Utils.log(`TomatNaviIO: Invalid button ID ${buttonUpdate.id} (expected 1-4)`);
                    }
                }
            }
        }

        Utils.log('TomatNaviIO: State update applied', stateData);
    }

    /**
     * Set state for all h1-h4 buttons in a row
     * @param {number} row - Row number (1-4)
     * @param {string} state - State: 'INACTIVE', 'ACTIVE', or 'PULSATING'
     */
    setRowState(row, state) {
        if (!this.buttonStates[row]) return;

        // Update only h1-h4 buttons in row (not enter button)
        for (let i = 0; i < 4; i++) {
            this.buttonStates[row][i] = state;
            this.applyVisualState(row, i, state);
        }

        Utils.log(`TomatNaviIO: Row ${row} h1-h4 buttons set to ${state}`);
    }

    /**
     * Set state for an individual h1-h4 button
     * @param {number} row - Row number (1-4)
     * @param {number} buttonIndex - Button index (0-3 for h1-h4)
     * @param {string} state - State: 'INACTIVE', 'ACTIVE', or 'PULSATING'
     */
    setButtonState(row, buttonIndex, state) {
        if (!this.buttonStates[row]) return;

        this.buttonStates[row][buttonIndex] = state;
        this.applyVisualState(row, buttonIndex, state);

        Utils.log(`TomatNaviIO: Button row ${row}, index ${buttonIndex} set to ${state}`);
    }

    /**
     * Apply visual feedback to a h1-h4 button based on state
     * @param {number} row - Row number (1-4)
     * @param {number} buttonIndex - Button index (0-3)
     * @param {string} state - State: 'INACTIVE', 'ACTIVE', or 'PULSATING'
     */
    applyVisualState(row, buttonIndex, state) {
        // Find the button element
        const rowElement = document.querySelector(`.ui-row[data-row="${row}"]`);
        if (!rowElement) return;

        const buttons = rowElement.querySelectorAll('.h-btn');
        const button = buttons[buttonIndex];
        if (!button) return;

        // Remove all state classes
        button.classList.remove('state-inactive', 'state-active', 'state-pulsating');

        // Add appropriate state class
        switch (state) {
            case 'INACTIVE':
                button.classList.add('state-inactive');
                break;
            case 'ACTIVE':
                button.classList.add('state-active');
                break;
            case 'PULSATING':
                button.classList.add('state-pulsating');
                break;
        }
    }

    /**
     * Reset all h1-h4 buttons to INACTIVE state
     */
    resetAllStates() {
        for (let row = 1; row <= 4; row++) {
            for (let i = 0; i < 4; i++) {
                this.buttonStates[row][i] = 'INACTIVE';
                this.applyVisualState(row, i, 'INACTIVE');
            }
        }
        Utils.log('TomatNaviIO: All button states reset to INACTIVE');
    }

    /**
     * Get the state of a h1-h4 button
     * @param {number} row - Row number (1-4)
     * @param {number} buttonIndex - Button index (0-3 for h1-h4)
     * @returns {string|null} State: 'INACTIVE', 'ACTIVE', or 'PULSATING', or null if not a state-managed button
     */
    getButtonState(row, buttonIndex) {
        if (!this.buttonStates[row]) return null;
        return this.buttonStates[row][buttonIndex] || null;
    }

    /**
     * Parse coded string format: "1P,2,3,4*"
     * Format: comma-separated values, each representing a row (1-4).
     * Ends with *.
     * Values: Button ID (1-4), optional 'P' suffix for PULSATING.
     * Default state is ACTIVE if no P.
     * @param {string} str - The coded string
     * @returns {Object|null} State object compatible with handleStateUpdate or null if invalid
     */
    parseEncodedString(str) {
        // Quick validation: must be string and end with *
        if (!str || typeof str !== 'string' || !str.trim().endsWith('*')) {
            return null;
        }

        const content = str.trim().slice(0, -1); // Remove trailing *
        const parts = content.split(',');

        // Limit to 4 rows as per spec
        const maxRows = Math.min(parts.length, 4);
        const rows = [];
        let hasValidParts = false;

        for (let i = 0; i < maxRows; i++) {
            const part = parts[i].trim();
            if (!part) continue;

            const rowNum = i + 1;
            let state = 'ACTIVE';
            let btnStr = part;

            // Check for Pulsating modifier
            if (part.toUpperCase().includes('P')) {
                state = 'PULSATING';
                btnStr = part.replace(/P/i, '');
            }

            const btnId = parseInt(btnStr, 10);

            if (!isNaN(btnId) && btnId >= 1 && btnId <= 4) {
                rows.push({
                    row: rowNum,
                    buttons: [
                        { id: btnId, state: state }
                    ]
                });
                hasValidParts = true;
            } else {
                Utils.log(`TomatNaviIO: Invalid button ID in coded string segment: ${part}`);
            }
        }

        if (!hasValidParts && parts.length > 0 && parts[0] !== '') {
            // If we had parts but failed to parse any, maybe log warning
            // If input was just "*", parts is [""] (empty), effectively clearing.
            // If input "X*" -> invalid ID X.
            return { rows: [] }; // Return empty rows to clear everything
        }

        return { rows: rows };
    }
}
