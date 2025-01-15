let monitoringInterval = null;
let isMonitoring = false;

// URL kontrolü için yardımcı fonksiyon
function isCorrectUrl(url) {
  return url === 'https://app.airtm.com/peer-transfers/available';
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isMonitoring && changeInfo.url) {
    // Eğer URL değiştiyse ve doğru URL değilse monitoring'i durdur
    if (!isCorrectUrl(changeInfo.url)) {
      stopMonitoring();
      chrome.runtime.sendMessage({action: 'monitoringStopped'});
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startMonitoring') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (isCorrectUrl(tabs[0].url)) {
        startMonitoring(message.interval);
        sendResponse({success: true});
      } else {
        sendResponse({success: false, error: 'Wrong URL'});
      }
    });
  } else if (message.action === 'stopMonitoring') {
    stopMonitoring();
    sendResponse({success: true});
  } else if (message.action === 'getState') {
    sendResponse({isMonitoring: isMonitoring});
  }
  return true;
});

function startMonitoring(interval) {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }

  isMonitoring = true;
  
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const tabId = tabs[0].id;
    
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      function: injectMonitoringCode,
      args: [parseInt(interval) * 1000]
    });
  });
}

function stopMonitoring() {
  isMonitoring = false;
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
}

// Telegram notification function
async function sendTelegramNotification(message) {
  try {
    // Get bot token and chat ID from storage
    const { telegramBotToken, telegramChatId } = await chrome.storage.sync.get(['telegramBotToken', 'telegramChatId']);
    
    if (!telegramBotToken || !telegramChatId) {
      console.error('Telegram credentials not found');
      return;
    }

    const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Telegram notification sent successfully');
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
  }
}

function injectMonitoringCode(interval) {
  function clickTargetButton() {
    try {
      const actionButton = document.querySelector('.card-p2p__action button');
      if (actionButton) {
        actionButton.click();
        console.log('Button clicked');
        // Send Telegram notification when button is clicked
        sendTelegramNotification('New Transaction Found!\n\nButton clicked automatically.\nTime: ' + new Date().toLocaleString());
      }
    } catch (error) {
      console.error('Button click error:', error);
    }
  }

  async function refreshFilters() {
    try {
      const filterButton = document.querySelector('[data-testid="filter-peer-requests"]');
      if (filterButton) {
        filterButton.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        const applyButton = document.querySelector('button.btn.btn--primary:not(.btn--block)');
        if (applyButton) {
          applyButton.click();
          console.log('Filters refreshed');
        }
      }
    } catch (error) {
      console.error('Filter refresh error:', error);
    }
  }

  async function monitorTransactions() {
    await refreshFilters();
    
    const emptySection = document.querySelector('.empty-section');
    const currentState = !emptySection;
    
    if (currentState !== window.lastState) {
      if (currentState && !window.notificationSent) {
        console.log('New transaction found!');
        chrome.runtime.sendMessage({
          action: 'notify',
          title: 'New Transaction!',
          message: 'A new transaction request has arrived!'
        });
        clickTargetButton();
        window.notificationSent = true;
      } else if (!currentState) {
        window.notificationSent = false;
      }
      window.lastState = currentState;
    } else {
      console.log('Checked - ' + new Date().toLocaleTimeString());
    }
  }

  window.notificationSent = false;
  window.lastState = true;
  
  // Mevcut interval'i temizle
  if (window.monitorInterval) {
    clearInterval(window.monitorInterval);
  }
  
  // Yeni interval başlat
  window.monitorInterval = setInterval(monitorTransactions, interval);
  monitorTransactions(); // İlk kontrolü hemen yap
  
  console.log('Transaction monitor başlatıldı (' + interval/1000 + ' saniyede bir kontrol).');
}