// Global variables
let mediaRecorder = null;
let audioContext = null;
let audioStream = null;
let isListening = false;
let isRecording = false;
let audioBuffer = [];
let recordings = [];
let bufferDuration = 30; // Change this value to modify buffer duration (in seconds)
let extensionDuration = 10;

// DOM elements
const permissionScreen = document.getElementById('permissionScreen');
const mainApp = document.getElementById('mainApp');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const bufferInfo = document.getElementById('bufferInfo');
const recordButton = document.getElementById('recordButton');
const errorMessage = document.getElementById('errorMessage');
const recordingsList = document.getElementById('recordingsList');
const notification = document.getElementById('notification');

async function requestMicrophonePermission() {
    try {
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 16000
            }
        });
        
        permissionScreen.style.display = 'none';
        mainApp.style.display = 'block';
        showNotification('Microphone access granted!');
        
        await initAudioProcessing();
        
    } catch (error) {
        let message = 'Microphone access denied. ';
        if (error.name === 'NotAllowedError') {
            message += 'Please allow microphone access in your browser settings.';
        } else if (error.name === 'NotFoundError') {
            message += 'No microphone found on your device.';
        } else {
            message += error.message;
        }
        showError(message);
    }
}

async function initAudioProcessing() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        mediaRecorder = new MediaRecorder(audioStream, {
            mimeType: 'audio/webm;codecs=opus'
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioBuffer.push({
                    data: event.data,
                    timestamp: Date.now()
                });
                
                // Keep only the last bufferDuration seconds of audio
                const cutoffTime = Date.now() - (bufferDuration * 1000);
                audioBuffer = audioBuffer.filter(chunk => chunk.timestamp > cutoffTime);
            }
        };

        updateStatus('idle', 'Ready to record');
        recordButton.disabled = false;
        
    } catch (error) {
        showError('Failed to initialize audio processing: ' + error.message);
    }
}

// Button press handler
function handleButtonPress() {
    if (!isListening && !isRecording) {
        startListening();
    } else if (isListening && !isRecording) {
        startRecording();
    }
}

function startListening() {
    try {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        mediaRecorder.start(100); // Record in 100ms chunks
        isListening = true;
        
        updateStatus('listening', 'Listening... Press to save recording');
        updateButton('🔴', 'Save Recording');
        recordButton.classList.add('listening');
        updateBufferInfo();

        showNotification('Started listening');
        
    } catch (error) {
        showError('Failed to start listening: ' + error.message);
    }
}

function startRecording() {
    if (!isListening) return;
    
    isRecording = true;
    updateStatus('recording', 'Recording additional 10 seconds...');
    updateButton('⏸️', 'Recording...', true);
    recordButton.classList.remove('listening');
    recordButton.classList.add('recording');
    
    showNotification('Saving recording...');
    
    setTimeout(() => {
        stopRecording();
    }, extensionDuration * 1000);
}

function stopRecording() {
    if (!isListening) return;
    
    mediaRecorder.stop();
    isListening = false;
    isRecording = false;
    
    setTimeout(() => {
        saveRecording();
        resetToIdle();
    }, 100);
}

function saveRecording() {
    if (audioBuffer.length === 0) {
        showError('No audio data to save');
        return;
    }

    const recordingData = audioBuffer.map(chunk => chunk.data);
    const blob = new Blob(recordingData, { type: 'audio/webm;codecs=opus' });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `recording_${timestamp}.webm`;
    
    const recording = {
        id: Date.now(),
        name: filename,
        blob: blob,
        timestamp: new Date(),
        duration: bufferDuration + extensionDuration
    };
    
    recordings.unshift(recording);
    updateRecordingsList();
    
    showNotification('Recording saved successfully!');
    audioBuffer = [];
}

function resetToIdle() {
    updateStatus('idle', 'Ready to record');
    updateButton('🎤', 'Start Listening');
    recordButton.disabled = false;
    recordButton.classList.remove('listening', 'recording');
    updateBufferInfo();
}

function updateStatus(status, text) {
    statusDot.className = `status-dot ${status}`;
    statusText.textContent = text;
}

function updateButton(icon, text, disabled = false) {
    recordButton.innerHTML = `
        <div class="button-icon">${icon}</div>
        <div class="button-text">${text}</div>
    `;
    recordButton.disabled = disabled;
}

function updateBufferInfo() {
    if (isListening) {
        bufferInfo.textContent = `Buffering last ${bufferDuration}s • Will record +${extensionDuration}s`;
    } else {
        bufferInfo.textContent = `Buffer stores last ${bufferDuration} seconds`;
    }
}

function updateRecordingsList() {
    recordingsList.innerHTML = '';
    
    recordings.forEach(recording => {
        const item = document.createElement('div');
        item.className = 'recording-item';
        item.innerHTML = `
            <div class="recording-info">
                <div class="recording-name">${recording.name}</div>
                <div class="recording-time">${recording.timestamp.toLocaleString()}</div>
            </div>
            <button class="download-btn" onclick="downloadRecording(${recording.id})">
                Download
            </button>
        `;
        recordingsList.appendChild(item);
    });
}

function downloadRecording(id) {
    const recording = recordings.find(r => r.id === id);
    if (!recording) return;
    
    const url = URL.createObjectURL(recording.blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = recording.name;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    showNotification('Download started');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

function showNotification(message, isError = false) {
    notification.textContent = message;
    notification.className = `notification ${isError ? 'error' : ''} show`;
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isListening) {
        console.log('App backgrounded while listening');
    }
});

// Prevent zoom on mobile
document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
});