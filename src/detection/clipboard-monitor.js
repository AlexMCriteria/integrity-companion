const { clipboard } = require('electron');

// Patterns that suggest AI-generated or suspicious clipboard content
const SUSPICIOUS_PATTERNS = [
  { pattern: /```[\s\S]{50,}```/m, label: 'code-block', description: 'Large code block in clipboard' },
  { pattern: /As an AI|I'm an AI|I cannot|I can help/i, label: 'ai-preamble', description: 'AI-style response preamble' },
  { pattern: /Here's? (?:the|a|my) (?:solution|answer|approach)/i, label: 'ai-answer', description: 'AI-style answer prefix' },
  { pattern: /Step \d+:|First,.*Second,.*Third,/is, label: 'structured-answer', description: 'Highly structured answer' },
];

class ClipboardMonitor {
  constructor(onSignal) {
    this.onSignal = onSignal;
    this.intervalId = null;
    this.pollIntervalMs = 3000;
    this.lastClipboardText = '';
    this.lastChangeTime = 0;
    this.changeCount = 0;
  }

  start() {
    this.lastClipboardText = clipboard.readText() || '';
    this.intervalId = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  poll() {
    try {
      const currentText = clipboard.readText() || '';

      if (currentText !== this.lastClipboardText && currentText.length > 0) {
        const now = Date.now();
        this.changeCount++;

        // Check for rapid clipboard changes (suggests copy-pasting from another app)
        if (now - this.lastChangeTime < 5000 && this.changeCount > 2) {
          this.onSignal({
            type: 'clipboard-rapid-change',
            severity: 'medium',
            metadata: {
              changesInWindow: this.changeCount,
              contentLength: currentText.length,
            },
          });
        }

        // Check for suspicious content patterns
        for (const { pattern, label, description } of SUSPICIOUS_PATTERNS) {
          if (pattern.test(currentText)) {
            this.onSignal({
              type: 'clipboard-suspicious-content',
              severity: 'high',
              metadata: {
                patternMatch: label,
                description,
                contentLength: currentText.length,
                preview: currentText.substring(0, 100) + (currentText.length > 100 ? '...' : ''),
              },
            });
            break;
          }
        }

        // Check for unusually long clipboard content (likely pasted from AI)
        if (currentText.length > 500) {
          this.onSignal({
            type: 'clipboard-large-content',
            severity: 'medium',
            metadata: {
              contentLength: currentText.length,
              preview: currentText.substring(0, 80) + '...',
            },
          });
        }

        this.lastClipboardText = currentText;
        this.lastChangeTime = now;

        // Reset change count after quiet period
        setTimeout(() => {
          this.changeCount = 0;
        }, 10000);
      }
    } catch {
      // Clipboard access error — skip
    }
  }
}

module.exports = { ClipboardMonitor };
