/**
 * AuthUI Utility for displaying backend messages
 */
const AuthUI = {
    show(message, type = 'success') {
        let container = document.querySelector('.auth-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'auth-notification-container';
            document.body.appendChild(container);
        }

        const msgElement = document.createElement('div');
        msgElement.className = `auth-message ${type}`;
        
        const icon = type === 'success' ? '✅' : '⚠️';
        
        msgElement.innerHTML = `
            <span style="font-size: 1.2rem;">${icon}</span>
            <div style="flex-grow: 1;">
                <p style="margin: 0; font-weight: 500; font-size: 0.9rem;">${message}</p>
            </div>
        `;

        container.appendChild(msgElement);

        // Automatically remove after 4 seconds
        setTimeout(() => {
            msgElement.classList.add('fade-out');
            setTimeout(() => {
                if (msgElement.parentNode) msgElement.remove();
            }, 300);
        }, 4000);
    }
};

// Expose globally
window.AuthUI = AuthUI;