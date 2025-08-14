// Status messages and notifications

// Show status message
function showStatus(message, type = 'info') {
    const status = document.getElementById('status');
    status.className = `status ${type}`;
    status.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${message}`;
    status.style.display = 'flex';
    
    if (type === 'success') {
        setTimeout(() => {
            status.style.display = 'none';
        }, 5000);
    }
}
