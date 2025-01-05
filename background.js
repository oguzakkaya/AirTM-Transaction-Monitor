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

function injectMonitoringCode(interval) {
  function clickTargetButton() {
    try {
      const actionButton = document.querySelector('.card-p2p__action button');
      if (actionButton) {
        actionButton.click();
        console.log('Butona tıklandı');
      }
    } catch (error) {
      console.error('Buton tıklama hatası:', error);
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
          console.log('Filtreler yenilendi');
        }
      }
    } catch (error) {
      console.error('Filtre yenileme hatası:', error);
    }
  }

  async function monitorTransactions() {
    await refreshFilters();
    
    const emptySection = document.querySelector('.empty-section');
    const currentState = !emptySection;
    
    if (currentState !== window.lastState) {
      if (currentState && !window.notificationSent) {
        console.log('Yeni transaction bulundu!');
        chrome.runtime.sendMessage({
          action: 'notify',
          title: 'Yeni Transaction!',
          message: 'Yeni bir transaction request geldi!'
        });
        clickTargetButton();
        window.notificationSent = true;
      } else if (!currentState) {
        window.notificationSent = false;
      }
      window.lastState = currentState;
    } else {
      console.log('Kontrol edildi - ' + new Date().toLocaleTimeString());
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