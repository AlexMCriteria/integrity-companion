class DisplayMonitor {
  constructor(onSignal, electronScreen) {
    this.onSignal = onSignal;
    this.screen = electronScreen;
    this.intervalId = null;
    this.pollIntervalMs = 5000;
    this.lastDisplayCount = 0;
    this.initialCheckDone = false;
  }

  start() {
    this.check();
    this.intervalId = setInterval(() => this.check(), this.pollIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  check() {
    const displays = this.screen.getAllDisplays();
    const displayCount = displays.length;

    if (!this.initialCheckDone) {
      this.initialCheckDone = true;
      this.lastDisplayCount = displayCount;

      if (displayCount > 1) {
        this.onSignal({
          type: 'multi-display',
          severity: 'medium',
          metadata: {
            displayCount,
            displays: displays.map((d) => ({
              id: d.id,
              width: d.size.width,
              height: d.size.height,
              internal: d.internal || false,
            })),
          },
        });
      }
      return;
    }

    // Detect display changes (plugging in/removing monitors during test)
    if (displayCount !== this.lastDisplayCount) {
      const added = displayCount > this.lastDisplayCount;
      this.onSignal({
        type: 'display-change',
        severity: 'high',
        metadata: {
          previousCount: this.lastDisplayCount,
          currentCount: displayCount,
          change: added ? 'added' : 'removed',
          displays: displays.map((d) => ({
            id: d.id,
            width: d.size.width,
            height: d.size.height,
          })),
        },
      });
      this.lastDisplayCount = displayCount;
    }
  }
}

module.exports = { DisplayMonitor };
