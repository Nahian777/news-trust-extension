// Load trust database from external JSON file
let trustDatabase = {};

// Load the database
fetch('trustDatabase.json')
  .then(response => response.json())
  .then(data => {
    trustDatabase = data;
    // After loading database, get current tab and display data
    loadCurrentPageData();
  })
  .catch(error => {
    console.error('Error loading trust database:', error);
  });

// Load user reviews from Chrome Storage and merge with base data
async function getUserReviews(domain) {
  return new Promise((resolve) => {
    chrome.storage.local.get([domain], (result) => {
      resolve(result[domain] || null);
    });
  });
}

// Save user review to Chrome Storage
async function saveUserReview(domain, review) {
  return new Promise((resolve) => {
    // Get existing reviews for this domain
    chrome.storage.local.get([domain], (result) => {
      let domainData = result[domain] || { reviews: [] };
      
      // Add new review
      domainData.reviews.push({
        accuracy: review.accuracy,
        bias: review.bias,
        trustworthiness: review.trustworthiness,
        overallScore: review.overallScore,
        timestamp: new Date().toISOString()
      });
      
      // Calculate new averages
      const reviews = domainData.reviews;
      const totalReviews = reviews.length;
      
      domainData.avgAccuracy = Math.round(reviews.reduce((sum, r) => sum + r.accuracy, 0) / totalReviews);
      domainData.avgBias = Math.round(reviews.reduce((sum, r) => sum + r.bias, 0) / totalReviews);
      domainData.avgTrustworthiness = Math.round(reviews.reduce((sum, r) => sum + r.trustworthiness, 0) / totalReviews);
      domainData.avgOverall = Math.round(reviews.reduce((sum, r) => sum + r.overallScore, 0) / totalReviews);
      domainData.totalReviews = totalReviews;
      
      // Save back to storage
      chrome.storage.local.set({ [domain]: domainData }, () => {
        resolve(domainData);
      });
    });
  });
}

// Merge base data with user reviews
async function getMergedData(domain) {
  const baseData = trustDatabase[domain];
  const userData = await getUserReviews(domain);
  
  if (!userData || userData.totalReviews === 0) {
    return baseData; // Return base data if no user reviews
  }
  
  // Merge: User reviews override base data
  return {
    name: baseData.name,
    trustScore: userData.avgOverall,
    reputation: baseData.reputation, // Keep base reputation
    accuracy: userData.avgAccuracy,
    bias: userData.avgBias,
    transparency: baseData.transparency, // Keep base transparency
    userEngagement: baseData.userEngagement, // Keep base engagement
    totalReviews: baseData.totalReviews + userData.totalReviews,
    status: userData.avgOverall >= 80 ? 'trusted' : userData.avgOverall >= 60 ? 'moderate' : 'untrusted'
  };
}

function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    
    // Check if domain exists in database
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

function getStatusClass(score) {
  if (score === null) return 'unknown';
  if (score >= 80) return 'trusted';
  if (score >= 60) return 'moderate';
  return 'untrusted';
}

function getStatusText(score) {
  if (score === null) return '? Unknown Source';
  if (score >= 80) return '✓ Trusted Source';
  if (score >= 60) return '⚠ Moderate Trust';
  return '✗ Low Trust';
}

function createRadarChart(data) {
  const ctx = document.getElementById('radarChart');
  
  // Wait for Chart.js to be fully loaded
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded yet');
    setTimeout(() => createRadarChart(data), 100);
    return;
  }
  
  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Reputation', 'Accuracy', 'Bias Control', 'Transparency', 'User Engagement'],
      datasets: [{
        label: 'Trust Metrics',
        data: [data.reputation, data.accuracy, data.bias, data.transparency, data.userEngagement],
        fill: true,
        backgroundColor: 'rgba(102, 126, 234, 0.2)',
        borderColor: 'rgb(102, 126, 234)',
        pointBackgroundColor: 'rgb(102, 126, 234)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(102, 126, 234)'
      }]
    },
    options: {
      elements: {
        line: {
          borderWidth: 3
        }
      },
      scales: {
        r: {
          angleLines: {
            display: true
          },
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: {
            stepSize: 20
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

function loadCurrentPageData() {
  chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
    const currentUrl = tabs[0].url;
    const domain = getDomainFromUrl(currentUrl);
    
    // Get merged data (base + user reviews)
    const data = await getMergedData(domain);
    
    const contentDiv = document.getElementById('content');
    
    const scoreDisplay = data.trustScore === null ? 'N/A' : data.trustScore;
    const scoreColor = data.trustScore === null ? '#9ca3af' : (data.trustScore >= 80 ? '#10b981' : data.trustScore >= 60 ? '#f59e0b' : '#ef4444');
    
    contentDiv.innerHTML = `
      <div class="trust-score">
        <div class="source-info">
          Source: <span class="source-name">${data.name}</span>
        </div>
        <div class="score-number" style="color: ${scoreColor}">
          ${scoreDisplay}
        </div>
        <div class="score-label">Trust Score (out of 100)</div>
        <div style="text-align: center;">
          <span class="status-badge ${getStatusClass(data.trustScore)}">
            ${getStatusText(data.trustScore)}
          </span>
        </div>
        <div class="metrics">
          <div class="metric">
            <div class="metric-value">${data.totalReviews === 0 ? '-' : data.totalReviews.toLocaleString()}</div>
            <div class="metric-label">Reviews</div>
          </div>
          <div class="metric">
            <div class="metric-value">${data.accuracy === 0 ? '-' : data.accuracy + '%'}</div>
            <div class="metric-label">Accuracy</div>
          </div>
          <div class="metric">
            <div class="metric-value">${data.reputation === 0 ? '-' : data.reputation + '%'}</div>
            <div class="metric-label">Reputation</div>
          </div>
        </div>
      </div>
      
      ${data.trustScore !== null ? `
      <div class="chart-container">
        <canvas id="radarChart"></canvas>
      </div>
      ` : `
      <div class="chart-container" style="text-align: center; color: #666; padding: 30px;">
        <div style="font-size: 48px; margin-bottom: 10px;">📊</div>
        <div style="font-size: 14px;">No data available for this source</div>
        <div style="font-size: 12px; margin-top: 8px; color: #999;">Be the first to rate this article!</div>
      </div>
      `}
      
      <button class="toggle-review-btn" id="toggleReviewBtn">
        ➕ Rate This Article
      </button>
      
      <div class="review-section" id="reviewSection" style="display: none;">
        <div class="review-title">Rate This Article</div>
        
        <div class="rating-item">
          <div class="rating-label">Accuracy</div>
          <div class="rating-input">
            <input type="range" min="1" max="10" value="5" class="rating-slider" id="accuracySlider">
            <span class="rating-value" id="accuracyValue">5</span>
          </div>
        </div>
        
        <div class="rating-item">
          <div class="rating-label">Bias Control</div>
          <div class="rating-input">
            <input type="range" min="1" max="10" value="5" class="rating-slider" id="biasSlider">
            <span class="rating-value" id="biasValue">5</span>
          </div>
        </div>
        
        <div class="rating-item">
          <div class="rating-label">Trustworthiness</div>
          <div class="rating-input">
            <input type="range" min="1" max="10" value="5" class="rating-slider" id="trustSlider">
            <span class="rating-value" id="trustValue">5</span>
          </div>
        </div>
        
        <button class="submit-btn" id="submitReviewBtn">Submit Review</button>
        <div class="success-message" id="successMessage">✓ Review submitted successfully!</div>
      </div>
    `;
    
    // Create the radar chart only if data exists
    if (data.trustScore !== null) {
      setTimeout(() => createRadarChart(data), 300);
    }
    
    // Add event listeners for the review section
    setupReviewListeners(domain);
  });
}

function setupReviewListeners(domain) {
  // Toggle review section
  const toggleBtn = document.getElementById('toggleReviewBtn');
  const reviewSection = document.getElementById('reviewSection');
  
  toggleBtn.addEventListener('click', () => {
    if (reviewSection.style.display === 'none') {
      reviewSection.style.display = 'block';
      toggleBtn.textContent = '➖ Hide Review Form';
    } else {
      reviewSection.style.display = 'none';
      toggleBtn.textContent = '➕ Rate This Article';
    }
  });
  
  // Update slider values in real-time
  const accuracySlider = document.getElementById('accuracySlider');
  const biasSlider = document.getElementById('biasSlider');
  const trustSlider = document.getElementById('trustSlider');
  
  const accuracyValue = document.getElementById('accuracyValue');
  const biasValue = document.getElementById('biasValue');
  const trustValue = document.getElementById('trustValue');
  
  accuracySlider.addEventListener('input', (e) => {
    accuracyValue.textContent = e.target.value;
  });
  
  biasSlider.addEventListener('input', (e) => {
    biasValue.textContent = e.target.value;
  });
  
  trustSlider.addEventListener('input', (e) => {
    trustValue.textContent = e.target.value;
  });
  
  // Submit review
  const submitBtn = document.getElementById('submitReviewBtn');
  const successMessage = document.getElementById('successMessage');
  
  submitBtn.addEventListener('click', async () => {
    const accuracy = parseInt(accuracySlider.value) * 10; // Convert to 100 scale
    const bias = parseInt(biasSlider.value) * 10;
    const trust = parseInt(trustSlider.value) * 10;
    
    // Calculate overall score
    const overallScore = Math.round((accuracy + bias + trust) / 3);
    
    const review = {
      accuracy: accuracy,
      bias: bias,
      trustworthiness: trust,
      overallScore: overallScore
    };
    
    // Save review to Chrome Storage
    const updatedData = await saveUserReview(domain, review);
    
    console.log('Review saved to Chrome Storage:', {
      domain: domain,
      review: review,
      updatedAverages: updatedData
    });
    
    // Show success message
    successMessage.style.display = 'block';
    submitBtn.textContent = '✓ Submitted';
    submitBtn.disabled = true;
    
    setTimeout(() => {
      successMessage.style.display = 'none';
      submitBtn.textContent = 'Submit Review';
      submitBtn.disabled = false;
      reviewSection.style.display = 'none';
      toggleBtn.textContent = '➕ Rate This Article';
      
      // Reset sliders
      accuracySlider.value = 5;
      biasSlider.value = 5;
      trustSlider.value = 5;
      accuracyValue.textContent = 5;
      biasValue.textContent = 5;
      trustValue.textContent = 5;
      
      // Reload the page data to show updated scores
      loadCurrentPageData();
    }, 2000);
  });
}