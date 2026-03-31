/**
 * BackendReporter — Posts signals to the assessment app's API.
 *
 * Assessment API contract:
 *   POST /api/session/{sessionId}/signal   { type, metadata, source: "electron" }
 *   POST /api/session/{sessionId}/status   { status, details }
 *   POST /api/session/pair                 { pairingCode }
 */

class BackendReporter {
  constructor({ baseUrl }) {
    this.baseUrl = baseUrl;
    this.sessionId = null;
    this.signalQueue = [];
    this.flushIntervalId = null;
    this.flushIntervalMs = 1000;
  }

  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  start() {
    this.flushIntervalId = setInterval(
      () => this.flushSignals(),
      this.flushIntervalMs,
    );
  }

  stop() {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
    this.flushSignals();
  }

  enqueueSignal(signal) {
    this.signalQueue.push(signal);
  }

  async flushSignals() {
    if (!this.sessionId || this.signalQueue.length === 0) return;

    const batch = this.signalQueue.splice(0);

    for (const signal of batch) {
      try {
        await fetch(`${this.baseUrl}/api/session/${this.sessionId}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: signal.type,
            metadata: signal.metadata || {},
            source: "electron",
          }),
        });
      } catch (err) {
        console.error("[Reporter] Failed to send signal:", err.message);
      }
    }
  }

  async pair(pairingCode) {
    try {
      const res = await fetch(`${this.baseUrl}/api/session/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairingCode }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { error: data.error || `HTTP ${res.status}` };
      }

      const data = await res.json();
      this.sessionId = data.sessionId;
      return { sessionId: data.sessionId, status: data.status };
    } catch (err) {
      return { error: err.message };
    }
  }

  async updateStatus(status, details) {
    if (!this.sessionId) return { error: "No session" };

    try {
      const res = await fetch(
        `${this.baseUrl}/api/session/${this.sessionId}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, details }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { error: data.error || `HTTP ${res.status}` };
      }

      return await res.json();
    } catch (err) {
      return { error: err.message };
    }
  }
}

module.exports = { BackendReporter };
