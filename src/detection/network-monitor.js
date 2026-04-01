const { exec } = require('child_process');
const os = require('os');

// Known AI service domains/IPs to watch for
const SUSPICIOUS_HOSTS = [
  {
    pattern: /api\.anthropic\.com|claude\.ai/i,
    name: 'Anthropic/Claude',
    severity: 'critical',
    category: 'ai-service',
  },
  {
    pattern: /api\.openai\.com|chatgpt\.com|chat\.openai\.com/i,
    name: 'OpenAI/ChatGPT',
    severity: 'critical',
    category: 'ai-service',
  },
  {
    pattern: /gemini\.google|generativelanguage\.googleapis/i,
    name: 'Google Gemini',
    severity: 'high',
    category: 'ai-service',
  },
  {
    pattern: /api\.perplexity\.ai|perplexity\.ai/i,
    name: 'Perplexity',
    severity: 'critical',
    category: 'ai-service',
  },
  {
    pattern: /cluely\.com|api\.cluely/i,
    name: 'Cluely',
    severity: 'critical',
    category: 'ai-service',
  },
  {
    pattern: /copilot\.microsoft|github\.copilot/i,
    name: 'Copilot',
    severity: 'high',
    category: 'ai-service',
  },
  {
    pattern: /grok\.x\.ai|api\.x\.ai/i,
    name: 'Grok',
    severity: 'high',
    category: 'ai-service',
  },

  // Screen share / remote desktop
  {
    pattern: /teamviewer\.com/i,
    name: 'TeamViewer',
    severity: 'critical',
    category: 'remote-access',
  },
  {
    pattern: /anydesk\.com/i,
    name: 'AnyDesk',
    severity: 'critical',
    category: 'remote-access',
  },
];

class NetworkMonitor {
  constructor(onSignal) {
    this.onSignal = onSignal;
    this.intervalId = null;
    this.pollIntervalMs = 10000;
    this.detectedConnections = new Set();
  }

  start() {
    this.scan();
    this.intervalId = setInterval(() => this.scan(), this.pollIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  scan() {
    const platform = os.platform();
    let cmd;

    if (platform === 'darwin' || platform === 'linux') {
      // Get established connections with resolved hostnames
      cmd = 'lsof -i -nP 2>/dev/null | grep ESTABLISHED';
    } else if (platform === 'win32') {
      cmd = 'netstat -an | findstr ESTABLISHED';
    } else {
      return;
    }

    exec(cmd, { timeout: 8000 }, (error, stdout) => {
      if (error || !stdout) return;

      const lines = stdout.split('\n').filter(Boolean);
      const connectionInfo = lines.join(' ');

      for (const host of SUSPICIOUS_HOSTS) {
        const found = host.pattern.test(connectionInfo);
        const key = host.name;

        if (found && !this.detectedConnections.has(key)) {
          this.detectedConnections.add(key);
          this.onSignal({
            type: 'network-connection',
            severity: host.severity,
            metadata: {
              service: host.name,
              category: host.category,
              detectedAt: Date.now(),
            },
          });
        } else if (!found && this.detectedConnections.has(key)) {
          this.detectedConnections.delete(key);
        }
      }
    });
  }
}

module.exports = { NetworkMonitor };
