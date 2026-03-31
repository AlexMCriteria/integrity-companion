const EventEmitter = require('events');

const SEVERITY_SCORES = {
  critical: 20,
  high: 15,
  medium: 10,
  low: 5,
  info: 0,
};

class SignalAggregator extends EventEmitter {
  constructor() {
    super();
    this.signals = [];
    this.score = 100;
  }

  ingest(signal) {
    const enriched = {
      ...signal,
      id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: signal.timestamp || Date.now(),
      source: signal.source || 'os',
    };

    this.signals.push(enriched);

    const penalty = SEVERITY_SCORES[enriched.severity] || SEVERITY_SCORES.low;
    if (penalty > 0) {
      this.score = Math.max(0, this.score - penalty);
      this.emit('score-update', this.score);
    }

    this.emit('signal', enriched);
    return enriched;
  }

  getSignalCount() {
    return this.signals.length;
  }

  getScore() {
    return this.score;
  }

  getRecentSignals(count = 50) {
    return this.signals.slice(-count);
  }

  reset() {
    this.signals = [];
    this.score = 100;
  }
}

module.exports = { SignalAggregator };
