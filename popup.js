let isMonitoring = false;
let currentSettings = {
  checkInterval: 5,
  telegramBotToken: '',
  telegramChatId: ''
};

// Sayfa yüklendiğinde ayarları yükle
document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.sync.get(['monitorSettings', 'telegramBotToken', 'telegramChatId'], function(result) {
    if (result.monitorSettings) {
      currentSettings = result.monitorSettings;
      document.getElementById('checkInterval').value = currentSettings.checkInterval;
    }
    if (result.telegramBotToken) {
      document.getElementById('telegramBotToken').value = result.telegramBotToken;
    }
    if (result.telegramChatId) {
      document.getElementById('telegramChatId').value = result.telegramChatId;
    }
  });
});

// Ayarları kaydet butonu
document.getElementById('saveSettings').addEventListener('click', function() {
  const checkInterval = parseInt(document.getElementById('checkInterval').value);
  const telegramBotToken = document.getElementById('telegramBotToken').value;
  const telegramChatId = document.getElementById('telegramChatId').value;
  
  if (checkInterval < 1 || checkInterval > 60) {
    addToLog('Error: Interval must be between 1 and 60 seconds');
    return;
  }

  currentSettings.checkInterval = checkInterval;
  
  // Save monitor settings
  chrome.storage.local.set({
    monitorSettings: currentSettings
  });

  // Save Telegram settings
  chrome.storage.sync.set({
    telegramBotToken: telegramBotToken,
    telegramChatId: telegramChatId
  }, function() {
    addToLog('All settings saved');
    
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

// Test Telegram button
document.getElementById('testTelegram').addEventListener('click', async function() {
  const telegramBotToken = document.getElementById('telegramBotToken').value;
  const telegramChatId = document.getElementById('telegramChatId').value;

  if (!telegramBotToken || !telegramChatId) {
    addToLog('Error: Please enter Telegram credentials first');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: 'Test Message\n\nTelegram notifications are working!\n\nTime: ' + new Date().toLocaleString(),
        parse_mode: 'HTML'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.ok) {
      addToLog('Test message sent successfully!');
    } else {
      throw new Error(result.description || 'Unknown error');
    }
  } catch (error) {
    addToLog('Error sending test message: ' + error.message);
  }
});