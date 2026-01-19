// Load trust database from external JSON file
let trustDatabase = {};

// Load the database
fetch(chrome.runtime.getURL('trustDatabase.json'))
  .then(response => response.json())
  .then(data => {
    trustDatabase = data;
    // After loading database, show notification
    showFloatingNotification();
  })
  .catch(error => {
    console.error('Error loading trust database:', error);
  });

function getDomainFromUrl(url) {
  try {
    const hostname = window.location.hostname.replace('www.', '');
    
    for (let domain in trustDatabase) {
      if (hostname.includes(domain)) {
        return domain;
      }
    }
    return 'default';
  } catch (e) {
    return 'default';
  }
}

function getScoreColor(score) {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function getStatusIcon(score) {
  if (score >= 80) return '✓';
  if (score >= 60) return '⚠';
  return '✗';
}

function showFloatingNotification() {
  const domain = getDomainFromUrl(window.location.href);
  const data = trustDatabase[domain];
  
  // Don't show notification for unknown sources
  if (domain === 'default') {
    return;
  }
  
  // Check if notification already exists
  if (document.getElementById('trust-score-notification')) {
    return;
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'trust-score-notification';
  notification.innerHTML = `
    <div class="trust-notification-content">
      <div class="trust-icon">${getStatusIcon(data.trustScore)}</div>
      <div class="trust-info">
        <div class="trust-title">${data.name}</div>
        <div class="trust-score-text">Trust Score: <strong>${data.trustScore}/100</strong></div>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
  
  // Remove after 4 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 4000);
}