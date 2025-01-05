let isMonitoring = false;
let currentSettings = {
  checkInterval: 5
};

// Sayfa yüklendiğinde ayarları yükle
document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(['monitorSettings'], function(result) {
    if (result.monitorSettings) {
      currentSettings = result.monitorSettings;
      document.getElementById('checkInterval').value = currentSettings.checkInterval;
    }
  });
});

// Ayarları kaydet butonu
document.getElementById('saveSettings').addEventListener('click', function() {
  const checkInterval = parseInt(document.getElementById('checkInterval').value);
  
  if (checkInterval < 1 || checkInterval > 60) {
    addToLog('Error: Interval must be between 1 and 60 seconds');
    return;
  }

  currentSettings.checkInterval = checkInterval;
  
  chrome.storage.local.set({
    monitorSettings: currentSettings
  }, function() {
    addToLog('Settings saved');
    
    // Eğer monitoring aktifse, yeni ayarlarla yeniden başlat
    if (isMonitoring) {
      stopMonitoring();
      setTimeout(() => startMonitoring(), 100);
    }
  });
});

// Toggle monitoring butonu
document.getElementById('toggleButton').addEventListener('click', function() {
  if (!isMonitoring) {
    startMonitoring();
  } else {
    stopMonitoring();
  }
});

function startMonitoring() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = tabs[0].url;
    if (currentUrl === 'https://app.airtm.com/peer-transfers/available') {
      chrome.runtime.sendMessage({
        action: 'startMonitoring',
        interval: currentSettings.checkInterval
      });
      
      updateUI(true);
      addToLog('Monitoring started with ' + currentSettings.checkInterval + ' seconds interval');
    } else {
      addToLog('Error: Please open https://app.airtm.com/peer-transfers/available');
      addToLog('Current URL: ' + currentUrl);
    }
  });
}

function stopMonitoring() {
  chrome.runtime.sendMessage({action: 'stopMonitoring'});
  updateUI(false);
  addToLog('Monitoring stopped');
}

function updateUI(monitoring) {
  isMonitoring = monitoring;
  const button = document.getElementById('toggleButton');
  const status = document.getElementById('status');
  
  if (monitoring) {
    button.textContent = 'Stop Monitoring';
    button.className = 'stop';
    status.textContent = 'Monitoring: Active';
    status.className = 'status active';
  } else {
    button.textContent = 'Start Monitoring';
    button.className = 'start';
    status.textContent = 'Monitoring: Inactive';
    status.className = 'status inactive';
  }
}

function addToLog(message) {
  const log = document.getElementById('log');
  const time = new Date().toLocaleTimeString();
  log.innerHTML += `<div>[${time}] ${message}</div>`;
  log.scrollTop = log.scrollHeight;
}

// Check current state on popup open
chrome.runtime.sendMessage({action: 'getState'}, function(response) {
  if (response && response.isMonitoring) {
    updateUI(true);
  }
});