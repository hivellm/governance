// BIP-06 Governance System - Frontend Utilities

class GovernanceUI {
    constructor() {
        this.apiBase = window.location.origin + '/api';
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initializeComponents();
        this.setupAutoRefresh();
    }
    
    setupEventListeners() {
        // Form submissions with loading states
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', (e) => {
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i data-feather="loader" class="w-4 h-4 animate-spin"></i> Processing...';
                    feather.replace();
                }
            });
        });
        
        // Confirmation dialogs for destructive actions
        document.querySelectorAll('[data-confirm]').forEach(element => {
            element.addEventListener('click', (e) => {
                const message = element.getAttribute('data-confirm');
                if (!confirm(message)) {
                    e.preventDefault();
                }
            });
        });
        
        // Auto-expand textareas
        document.querySelectorAll('textarea').forEach(textarea => {
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            });
        });
    }
    
    initializeComponents() {
        // Initialize tooltips
        this.initTooltips();
        
        // Initialize modals
        this.initModals();
        
        // Initialize tabs
        this.initTabs();
    }
    
    initTooltips() {
        document.querySelectorAll('[data-tooltip]').forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                this.showTooltip(e.target, e.target.getAttribute('data-tooltip'));
            });
            
            element.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }
    
    initModals() {
        // Modal triggers
        document.querySelectorAll('[data-modal]').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                const modalId = trigger.getAttribute('data-modal');
                this.openModal(modalId);
            });
        });
        
        // Modal close buttons
        document.querySelectorAll('[data-modal-close]').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                this.closeModal();
            });
        });
        
        // Close modal on backdrop click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                this.closeModal();
            }
        });
    }
    
    initTabs() {
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = tab.getAttribute('data-tab');
                this.showTab(tabId);
            });
        });
    }
    
    setupAutoRefresh() {
        // Auto-refresh certain pages
        const autoRefreshPages = ['/dashboard', '/voting'];
        const currentPath = window.location.pathname;
        
        if (autoRefreshPages.some(page => currentPath.startsWith(page))) {
            setInterval(() => {
                if (!document.hidden) {
                    this.refreshData();
                }
            }, 30000); // 30 seconds
        }
    }
    
    // API Helper Methods
    async apiCall(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(this.apiBase + endpoint, options);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            this.showToast('Error: ' + error.message, 'error');
            throw error;
        }
    }
    
    // UI Helper Methods
    showToast(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="flex items-center space-x-2">
                <i data-feather="${this.getToastIcon(type)}" class="w-5 h-5"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-auto">
                    <i data-feather="x" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(toast);
        feather.replace();
        
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
    }
    
    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'alert-circle',
            warning: 'alert-triangle',
            info: 'info'
        };
        return icons[type] || 'info';
    }
    
    showTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.id = 'tooltip';
        tooltip.className = 'absolute z-50 px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-lg shadow-lg';
        tooltip.textContent = text;
        
        document.body.appendChild(tooltip);
        
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
    }
    
    hideTooltip() {
        const tooltip = document.getElementById('tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }
    
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }
    
    closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        });
    }
    
    showTab(tabId) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        // Remove active state from all tabs
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.classList.remove('border-blue-500', 'text-blue-400');
            tab.classList.add('border-transparent', 'text-gray-400');
        });
        
        // Show target tab content
        const targetContent = document.getElementById(tabId);
        if (targetContent) {
            targetContent.classList.remove('hidden');
        }
        
        // Activate clicked tab
        const activeTab = document.querySelector(`[data-tab="${tabId}"]`);
        if (activeTab) {
            activeTab.classList.remove('border-transparent', 'text-gray-400');
            activeTab.classList.add('border-blue-500', 'text-blue-400');
        }
    }
    
    async refreshData() {
        // Refresh dynamic content without full page reload
        try {
            const path = window.location.pathname;
            
            if (path === '/dashboard') {
                // Refresh dashboard stats
                const stats = await this.apiCall('/agents/statistics');
                // Update UI with new stats
                this.updateDashboardStats(stats);
            }
        } catch (error) {
            console.warn('Auto-refresh failed:', error.message);
        }
    }
    
    updateDashboardStats(stats) {
        // Update stat cards with new data
        const totalAgentsElement = document.querySelector('[data-stat="totalAgents"]');
        if (totalAgentsElement) {
            totalAgentsElement.textContent = stats.total;
        }
        
        const activeAgentsElement = document.querySelector('[data-stat="activeAgents"]');
        if (activeAgentsElement) {
            activeAgentsElement.textContent = stats.active;
        }
    }
    
    // Utility methods
    formatDate(dateString) {
        return new Date(dateString).toLocaleString();
    }
    
    formatPhase(phase) {
        const phases = {
            'proposal': 'Proposal',
            'discussion': 'Discussion',
            'revision': 'Revision',
            'voting': 'Voting',
            'resolution': 'Resolution',
            'execution': 'Execution'
        };
        return phases[phase] || phase;
    }
    
    formatStatus(status) {
        const statuses = {
            'draft': 'Draft',
            'discussion': 'In Discussion',
            'voting': 'Voting',
            'approved': 'Approved',
            'rejected': 'Rejected',
            'executed': 'Executed'
        };
        return statuses[status] || status;
    }
    
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Copied to clipboard', 'success');
        }).catch(() => {
            this.showToast('Failed to copy', 'error');
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.governanceUI = new GovernanceUI();
    
    // Initialize Feather icons
    feather.replace();
    
    // Show success/error messages from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const success = urlParams.get('success');
    
    if (error) {
        window.governanceUI.showToast(error, 'error');
    }
    
    if (success) {
        window.governanceUI.showToast(success, 'success');
    }
});

// Global helper functions
function confirmAction(message, callback) {
    if (confirm(message)) {
        callback();
    }
}

function showLoading(element) {
    element.classList.add('loading');
}

function hideLoading(element) {
    element.classList.remove('loading');
}
