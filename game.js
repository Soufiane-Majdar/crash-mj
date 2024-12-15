// Select elements
const playButton = document.getElementById("playButton");
const cashoutButton = document.getElementById("cashoutButton");
const betAmountInput = document.getElementById("betAmount");
const autoCashoutInput = document.getElementById("autoCashout");
const multiplierText = document.getElementById("multiplierText");
const gameResult = document.getElementById("gameResult");
const countdownText = document.getElementById("countdownText");
const countdownOverlay = document.getElementById("countdownOverlay");
const historyContainer = document.getElementById("historyContainer");

// Constants for states
const GAME_STATE = {
    INACTIVE: "inactive",
    COUNTDOWN: "countdown",
    ACTIVE: "active",
    CRASHED: "crashed",
};

// Variables
let multiplier = 1.0;
let gameInterval = null;
let countdown = 10; // Countdown before game starts
let gameState = GAME_STATE.INACTIVE;
let autoCashoutValue = null;
let cashoutTriggered = false;
let gameHistory = [];
let inactivityTimer = null;

// Enhanced Error Handling
const ErrorHandler = {
    log: (error, context = 'General') => {
        console.error(`[${context}] Error:`, error);
        // Future: Could send to error tracking service
    },
    trackError: (errorType, details) => {
        gameAnalytics.errors = gameAnalytics.errors || {};
        gameAnalytics.errors[errorType] = 
            (gameAnalytics.errors[errorType] || 0) + 1;
    }
};

// Robust Sound Management
class SoundManager {
    constructor() {
        this.sounds = {
            cashout: this.createAudio('sounds/cashout.mp3'),
            crash: this.createAudio('sounds/crash.mp3')
        };
        this.enabled = true;
    }

    createAudio(src) {
        const audio = new Audio(src);
        audio.onerror = (e) => {
            ErrorHandler.log(e, 'Audio Loading');
            ErrorHandler.trackError('audioLoadFail', { src });
        };
        return audio;
    }

    play(soundName) {
        if (!this.enabled) return;
        try {
            const sound = this.sounds[soundName];
            if (sound) {
                sound.currentTime = 0;
                sound.play().catch(e => {
                    ErrorHandler.log(e, 'Audio Playback');
                });
            }
        } catch (error) {
            ErrorHandler.log(error, 'Sound Playback');
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// Robust Settings Management
class GameSettingsManager {
    constructor() {
        this.defaultSettings = {
            soundEnabled: true,
            darkMode: false,
            autoCashoutDefault: 2.0
        };
        this.settings = this.load();
    }

    load() {
        try {
            const saved = localStorage.getItem('crashGameSettings');
            return saved ? JSON.parse(saved) : {...this.defaultSettings};
        } catch (error) {
            ErrorHandler.log(error, 'Settings Load');
            return {...this.defaultSettings};
        }
    }

    save() {
        try {
            localStorage.setItem('crashGameSettings', 
                JSON.stringify(this.settings));
        } catch (error) {
            ErrorHandler.log(error, 'Settings Save');
        }
    }

    get(key) {
        return this.settings[key] ?? this.defaultSettings[key];
    }

    set(key, value) {
        this.settings[key] = value;
        this.save();
    }

    reset() {
        this.settings = {...this.defaultSettings};
        this.save();
    }
}

// Robust Analytics Manager
class GameAnalyticsManager {
    constructor() {
        this.defaultAnalytics = {
            totalGames: 0,
            totalWinnings: 0,
            totalLosses: 0,
            highestMultiplier: 1.0,
            winStreak: 0,
            lossStreak: 0,
            errors: {}
        };
        this.analytics = this.load();
    }

    load() {
        try {
            const saved = localStorage.getItem('crashGameAnalytics');
            return saved ? JSON.parse(saved) : {...this.defaultAnalytics};
        } catch (error) {
            ErrorHandler.log(error, 'Analytics Load');
            return {...this.defaultAnalytics};
        }
    }

    save() {
        try {
            localStorage.setItem('crashGameAnalytics', 
                JSON.stringify(this.analytics));
        } catch (error) {
            ErrorHandler.log(error, 'Analytics Save');
        }
    }

    update(won, multiplier) {
        this.analytics.totalGames++;
        
        if (won) {
            this.analytics.totalWinnings += multiplier;
            this.analytics.winStreak++;
            this.analytics.lossStreak = 0;
        } else {
            this.analytics.totalLosses++;
            this.analytics.lossStreak++;
            this.analytics.winStreak = 0;
        }

        this.analytics.highestMultiplier = 
            Math.max(this.analytics.highestMultiplier, multiplier);

        this.save();
    }

    reset() {
        this.analytics = {...this.defaultAnalytics};
        this.save();
    }
}

// Global Instances
const soundManager = new SoundManager();
const settingsManager = new GameSettingsManager();
const analyticsManager = new GameAnalyticsManager();

// Function to reset the game state
function resetGame() {
    multiplier = 1.0;
    multiplierText.textContent = "1.00x";
    multiplierText.style.color = "#fff"; // Reset color
    playButton.disabled = false;
    cashoutButton.disabled = true;
    gameResult.textContent = "";
    cashoutTriggered = false;
    gameState = GAME_STATE.INACTIVE;
    autoCashoutValue = null;
    countdown = 10; // Reset countdown
    clearInterval(gameInterval);
    resetGameUI();
}

// Function to reset UI
function resetGameUI() {
    playButton.disabled = true;
    cashoutButton.disabled = false;
    countdownOverlay.classList.add("hidden");
    countdownText.textContent = countdown;
}

// Handle inactivity
function startInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        alert("Game inactive for too long. Restarting!");
        resetGame();
    }, 30000); // 30 seconds inactivity
}

// Countdown Timer
function startCountdown() {
    resetGame(); // Ensure fresh start
    gameState = GAME_STATE.COUNTDOWN;
    countdownOverlay.classList.remove("hidden");
    countdownText.textContent = countdown;

    const countdownInterval = setInterval(() => {
        countdown -= 1;
        countdownText.textContent = countdown;
        startInactivityTimer();

        if (countdown <= 0) {
            clearInterval(countdownInterval);
            countdownOverlay.classList.add("hidden");
            startGame();
        }
    }, 1000);
}

// Start Game Logic
function startGame() {
    resetGameUI();
    gameState = GAME_STATE.ACTIVE;
    playButton.disabled = true;
    cashoutButton.disabled = false;

    autoCashoutValue = parseFloat(autoCashoutInput.value) || null;
    if (autoCashoutValue <= 0) autoCashoutValue = null;

    gameInterval = setInterval(() => {
        try {
            // Increase multiplier
            multiplier += 0.01 + Math.random() * 0.05; // Random growth
            multiplierText.textContent = `${multiplier.toFixed(2)}x`;

            // Change multiplier text color dynamically
            multiplierText.style.color = "#0f0"; // Green while increasing

            // Check for auto cashout
            if (autoCashoutValue && multiplier >= autoCashoutValue && !cashoutTriggered) {
                handleCashout(true);
            }

            // Simulate crash
            if (Math.random() < 0.01 + multiplier / 100) { // Higher chance to crash at higher multipliers
                endGame();
            }
        } catch (error) {
            ErrorHandler.log(error, 'Game Progression');
            endGame();
        }
    }, 100);
}

// Handle Manual or Auto Cashout
function handleCashout(auto = false) {
    playButton.disabled = false;
    cashoutButton.disabled = true;
    if (gameState !== GAME_STATE.ACTIVE || cashoutTriggered) return;

    cashoutTriggered = true;
    clearInterval(gameInterval);
    gameState = GAME_STATE.INACTIVE;

    const betAmount = parseFloat(betAmountInput.value) || 0;
    if (betAmount <= 0) {
        alert("Invalid bet amount!");
        resetGame();
        return;
    }

    const winnings = (betAmount * multiplier).toFixed(2);

    gameResult.textContent = auto
        ? `Auto Cashout! You won $${winnings}`
        : `You cashed out! You won $${winnings}`;
    gameResult.style.color = "#0f0"; // Green for winning result

    updateHistory(multiplier.toFixed(2), "green");
    resetGameUI();
    soundManager.play('cashout');
    analyticsManager.update(true, multiplier);
}

// End Game (Crash)
function endGame() {
    if (gameState !== GAME_STATE.ACTIVE) return;

    clearInterval(gameInterval);
    gameState = GAME_STATE.CRASHED;

    gameResult.textContent = "Game Crashed!";
    gameResult.style.color = "#f00"; // Red for losing result
    multiplierText.style.color = "#f00"; // Red for crash multiplier

    updateHistory(multiplier.toFixed(2), "red");
    
    // Reset the game and enable the play button after a short delay
    setTimeout(() => {
        resetGame();
        playButton.disabled = false; // Ensure play button is re-enabled
    }, 2000);
    soundManager.play('crash');
    analyticsManager.update(false, multiplier);
}

// Update Game History
function updateHistory(value, color) {
    gameHistory.unshift({ value, color });
    if (gameHistory.length > 5) gameHistory.pop(); // Keep last 5 games

    const fragment = document.createDocumentFragment();
    gameHistory.forEach((entry) => {
        const historyItem = document.createElement("div");
        historyItem.className = "p-2 rounded text-center";
        historyItem.style.backgroundColor = entry.color === "green" ? "#0f0" : "#f00";
        historyItem.style.color = "#000"; // Text color
        historyItem.textContent = `${entry.value}x`;
        fragment.appendChild(historyItem);
    });

    historyContainer.innerHTML = ""; // Clear previous history
    historyContainer.appendChild(fragment);
}

// Event Listeners
playButton.addEventListener("click", () => {
    const betAmount = parseFloat(betAmountInput.value);
    if (!betAmount || betAmount <= 0) {
        alert("Please enter a valid bet amount!");
        return;
    }
    countdown = 10; // Reset countdown
    startCountdown();
    startInactivityTimer();
});

cashoutButton.addEventListener("click", () => handleCashout(false));

// Inactivity handler
window.addEventListener("mousemove", startInactivityTimer);
window.addEventListener("keydown", startInactivityTimer);

// Enhanced Settings Toggle
function createSettingsToggle() {
    const settingsContainer = document.createElement('div');
    settingsContainer.innerHTML = `
        <div class="settings-container">
            <button id="soundToggle">
                🔊 Sound: ${settingsManager.get('soundEnabled') ? 'ON' : 'OFF'}
            </button>
            <button id="darkModeToggle">
                🌓 Dark Mode: ${settingsManager.get('darkMode') ? 'ON' : 'OFF'}
            </button>
            <button id="resetAnalytics">
                🔄 Reset Analytics
            </button>
        </div>
    `;
    document.body.appendChild(settingsContainer);

    const soundToggle = document.getElementById('soundToggle');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const resetAnalyticsBtn = document.getElementById('resetAnalytics');

    soundToggle.addEventListener('click', () => {
        const newState = soundManager.toggle();
        settingsManager.set('soundEnabled', newState);
        soundToggle.textContent = `🔊 Sound: ${newState ? 'ON' : 'OFF'}`;
    });

    darkModeToggle.addEventListener('click', () => {
        const currentMode = settingsManager.get('darkMode');
        const newMode = !currentMode;
        settingsManager.set('darkMode', newMode);
        document.body.classList.toggle('dark-mode', newMode);
        darkModeToggle.textContent = `🌓 Dark Mode: ${newMode ? 'ON' : 'OFF'}`;
    });

    resetAnalyticsBtn.addEventListener('click', () => {
        analyticsManager.reset();
        alert('Game analytics have been reset!');
    });
}

// Initialize on load
window.addEventListener('load', () => {
    // Apply saved dark mode
    document.body.classList.toggle(
        'dark-mode', 
        settingsManager.get('darkMode')
    );
    
    createSettingsToggle();
});
