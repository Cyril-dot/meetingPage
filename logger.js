/**
 * Comprehensive Logging System for GetStream Video Meeting App
 * Tracks initialization, errors, participant events, media states, and performance
 */

class MeetingLogger {
    constructor(config = {}) {
        this.config = {
            enableConsole: config.enableConsole !== false,
            enableStorage: config.enableStorage !== false,
            maxStoredLogs: config.maxStoredLogs || 500,
            logLevel: config.logLevel || 'debug', // debug, info, warn, error
            enableTimestamp: config.enableTimestamp !== false,
            enableStackTrace: config.enableStackTrace !== false,
            categoryColors: {
                init: '#4F46E5',
                error: '#EF4444',
                media: '#10B981',
                participant: '#F59E0B',
                network: '#3B82F6',
                ui: '#8B5CF6',
                performance: '#EC4899'
            }
        };

        this.logs = [];
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.eventCounts = {};
        this.errorCounts = {};
        
        this.logLevels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };

        // Initialize storage
        if (this.config.enableStorage) {
            this.initStorage();
        }

        this.log('init', 'Logger initialized', { sessionId: this.sessionId });
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    initStorage() {
        try {
            const stored = localStorage.getItem('meetingLogs');
            if (stored) {
                this.logs = JSON.parse(stored).slice(-this.config.maxStoredLogs);
            }
        } catch (e) {
            console.warn('Failed to load stored logs:', e);
        }
    }

    shouldLog(level) {
        return this.logLevels[level] >= this.logLevels[this.config.logLevel];
    }

    log(category, message, data = null, level = 'info') {
        if (!this.shouldLog(level)) return;

        const logEntry = {
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            category,
            level,
            message,
            data,
            elapsed: Date.now() - this.startTime,
            stackTrace: this.config.enableStackTrace ? this.getStackTrace() : null
        };

        this.logs.push(logEntry);

        // Count events
        this.eventCounts[category] = (this.eventCounts[category] || 0) + 1;
        if (level === 'error') {
            this.errorCounts[category] = (this.errorCounts[category] || 0) + 1;
        }

        // Limit stored logs
        if (this.logs.length > this.config.maxStoredLogs) {
            this.logs = this.logs.slice(-this.config.maxStoredLogs);
        }

        // Console output
        if (this.config.enableConsole) {
            this.logToConsole(logEntry);
        }

        // Persist to storage
        if (this.config.enableStorage) {
            this.persistLogs();
        }

        return logEntry;
    }

    logToConsole(entry) {
        const color = this.config.categoryColors[entry.category] || '#6B7280';
        const timeStr = this.config.enableTimestamp 
            ? `[${new Date(entry.timestamp).toLocaleTimeString()}]` 
            : '';
        
        const prefix = `%c[${entry.category.toUpperCase()}]${timeStr}`;
        const style = `color: ${color}; font-weight: bold;`;

        const consoleMethod = entry.level === 'error' ? 'error' : 
                            entry.level === 'warn' ? 'warn' : 'log';

        if (entry.data) {
            console[consoleMethod](prefix, style, entry.message, entry.data);
        } else {
            console[consoleMethod](prefix, style, entry.message);
        }
    }

    getStackTrace() {
        try {
            throw new Error();
        } catch (e) {
            return e.stack?.split('\n').slice(3, 6).join('\n') || null;
        }
    }

    persistLogs() {
        try {
            localStorage.setItem('meetingLogs', JSON.stringify(this.logs));
        } catch (e) {
            console.warn('Failed to persist logs:', e);
        }
    }

    // Specific logging methods for different categories

    logInit(message, data) {
        return this.log('init', message, data, 'info');
    }

    logError(message, error, context = {}) {
        const errorData = {
            message: error?.message || error,
            name: error?.name,
            stack: error?.stack,
            ...context
        };
        return this.log('error', message, errorData, 'error');
    }

    logMedia(message, data) {
        return this.log('media', message, data, 'info');
    }

    logParticipant(message, data) {
        return this.log('participant', message, data, 'info');
    }

    logNetwork(message, data) {
        return this.log('network', message, data, 'info');
    }

    logUI(message, data) {
        return this.log('ui', message, data, 'debug');
    }

    logPerformance(message, timing) {
        return this.log('performance', message, { timing, elapsed: Date.now() - this.startTime }, 'info');
    }

    // GetStream specific logging

    logCallCreated(callId, participants) {
        return this.logInit('Call created', { callId, participantCount: participants });
    }

    logCallJoined(callId, userId) {
        return this.logInit('Successfully joined call', { callId, userId });
    }

    logCallError(error, context) {
        return this.logError('Call error occurred', error, context);
    }

    logParticipantJoined(participant) {
        return this.logParticipant('Participant joined', {
            userId: participant.userId,
            name: participant.name,
            isLocal: participant.isLocalParticipant,
            hasVideo: !!participant.videoStream,
            hasAudio: !!participant.audioStream
        });
    }

    logParticipantLeft(participant) {
        return this.logParticipant('Participant left', {
            userId: participant.userId,
            name: participant.name
        });
    }

    logMediaPermission(type, granted, error = null) {
        if (granted) {
            return this.logMedia(`${type} permission granted`, { type });
        } else {
            return this.logError(`${type} permission denied`, error, { type });
        }
    }

    logTrackPublished(type, participantId) {
        return this.logMedia(`Track published: ${type}`, { type, participantId });
    }

    logTrackUnpublished(type, participantId) {
        return this.logMedia(`Track unpublished: ${type}`, { type, participantId });
    }

    logICEConnectionState(state, callId) {
        return this.logNetwork('ICE connection state changed', { state, callId });
    }

    logDOMError(element, operation, error) {
        return this.logError(`DOM error: ${operation}`, error, { 
            element, 
            elementExists: !!document.getElementById(element) 
        });
    }

    // Analytics and reporting

    getStats() {
        const errorLogs = this.logs.filter(l => l.level === 'error');
        const categories = Object.keys(this.eventCounts);
        
        return {
            sessionId: this.sessionId,
            duration: Date.now() - this.startTime,
            totalLogs: this.logs.length,
            totalErrors: errorLogs.length,
            categoryCounts: this.eventCounts,
            errorCounts: this.errorCounts,
            recentErrors: errorLogs.slice(-10).map(e => ({
                timestamp: e.timestamp,
                message: e.message,
                category: e.category,
                data: e.data
            }))
        };
    }

    getLogsByCategory(category, limit = 50) {
        return this.logs
            .filter(l => l.category === category)
            .slice(-limit);
    }

    getLogsByLevel(level, limit = 50) {
        return this.logs
            .filter(l => l.level === level)
            .slice(-limit);
    }

    exportLogs(format = 'json') {
        const stats = this.getStats();
        const exportData = {
            stats,
            logs: this.logs,
            generatedAt: new Date().toISOString()
        };

        if (format === 'json') {
            return JSON.stringify(exportData, null, 2);
        } else if (format === 'csv') {
            return this.logsToCSV();
        }
    }

    logsToCSV() {
        const headers = ['Timestamp', 'Category', 'Level', 'Message', 'Data'];
        const rows = this.logs.map(log => [
            log.timestamp,
            log.category,
            log.level,
            log.message,
            JSON.stringify(log.data || '')
        ]);
        
        return [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
    }

    downloadLogs(filename = null, format = 'json') {
        const name = filename || `meeting-logs-${this.sessionId}.${format}`;
        const content = this.exportLogs(format);
        const blob = new Blob([content], { 
            type: format === 'json' ? 'application/json' : 'text/csv' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
    }

    clearLogs() {
        this.logs = [];
        this.eventCounts = {};
        this.errorCounts = {};
        if (this.config.enableStorage) {
            localStorage.removeItem('meetingLogs');
        }
        this.log('init', 'Logs cleared');
    }

    // UI Dashboard methods

    createDashboard() {
        const dashboard = document.createElement('div');
        dashboard.id = 'loggerDashboard';
        dashboard.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 400px;
            max-height: 600px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            z-index: 10000;
            display: none;
            flex-direction: column;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;

        dashboard.innerHTML = `
            <div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Meeting Logs</h3>
                <div>
                    <button onclick="meetingLogger.downloadLogs()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 12px; border-radius: 6px; margin-right: 8px; cursor: pointer; font-size: 12px;">Export</button>
                    <button onclick="document.getElementById('loggerDashboard').style.display='none'" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Close</button>
                </div>
            </div>
            <div style="padding: 16px; overflow-y: auto; max-height: 500px; background: #f9fafb;">
                <div id="loggerStats" style="margin-bottom: 16px;"></div>
                <div id="loggerContent" style="font-size: 12px;"></div>
            </div>
        `;

        document.body.appendChild(dashboard);
        this.updateDashboard();
        
        return dashboard;
    }

    updateDashboard() {
        const stats = this.getStats();
        const statsDiv = document.getElementById('loggerStats');
        const contentDiv = document.getElementById('loggerContent');

        if (!statsDiv || !contentDiv) return;

        // Stats
        statsDiv.innerHTML = `
            <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
                    <div><strong>Total Logs:</strong> ${stats.totalLogs}</div>
                    <div style="color: #EF4444;"><strong>Errors:</strong> ${stats.totalErrors}</div>
                    <div><strong>Duration:</strong> ${Math.round(stats.duration / 1000)}s</div>
                    <div><strong>Session:</strong> ${stats.sessionId.slice(-8)}</div>
                </div>
            </div>
        `;

        // Recent logs
        const recentLogs = this.logs.slice(-20).reverse();
        contentDiv.innerHTML = recentLogs.map(log => {
            const color = this.config.categoryColors[log.category] || '#6B7280';
            const levelColor = log.level === 'error' ? '#EF4444' : 
                              log.level === 'warn' ? '#F59E0B' : '#10B981';
            
            return `
                <div style="background: white; padding: 10px; margin-bottom: 8px; border-radius: 6px; border-left: 3px solid ${color};">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-weight: 600; color: ${color};">${log.category}</span>
                        <span style="font-size: 11px; color: #6B7280;">${new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div style="color: #1F2937;">${log.message}</div>
                    ${log.data ? `<div style="margin-top: 4px; padding: 6px; background: #F3F4F6; border-radius: 4px; font-family: monospace; font-size: 11px; overflow-x: auto;">${JSON.stringify(log.data, null, 2)}</div>` : ''}
                </div>
            `;
        }).join('');
    }

    toggleDashboard() {
        let dashboard = document.getElementById('loggerDashboard');
        if (!dashboard) {
            dashboard = this.createDashboard();
        }
        
        if (dashboard.style.display === 'none' || !dashboard.style.display) {
            dashboard.style.display = 'flex';
            this.updateDashboard();
        } else {
            dashboard.style.display = 'none';
        }
    }
}

// Global instance
if (typeof window !== 'undefined') {
    window.MeetingLogger = MeetingLogger;
    window.meetingLogger = new MeetingLogger({
        enableConsole: true,
        enableStorage: true,
        logLevel: 'debug'
    });

    // Keyboard shortcut to toggle dashboard (Ctrl+Shift+L)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'L') {
            window.meetingLogger.toggleDashboard();
        }
    });

    console.log('%c📊 Meeting Logger initialized! Press Ctrl+Shift+L to view logs', 
                'color: #4F46E5; font-weight: bold; font-size: 14px;');
}