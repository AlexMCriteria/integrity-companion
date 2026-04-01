const { WebSocket, WebSocketServer: WSServer } = require('ws');
const EventEmitter = require('events');

class WebSocketServer extends EventEmitter {
  constructor(port, onBrowserSignal) {
    super();
    this.port = port;
    this.onBrowserSignal = onBrowserSignal;
    this.wss = null;
    this.clients = new Set();
  }

  start() {
    this.wss = new WSServer({ port: this.port });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      this.emit('client-connected');

      // Send handshake
      ws.send(JSON.stringify({
        type: 'handshake',
        payload: {
          appVersion: '1.0.0',
          timestamp: Date.now(),
        },
      }));

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'auto-pair' && message.payload?.sessionId) {
            this.emit('auto-pair', message.payload.sessionId);
          }

          if (message.type === 'status-update' && message.payload?.status) {
            this.emit('status-update', message.payload.status);
          }

          if (message.type === 'signal' && message.payload) {
            this.onBrowserSignal(message.payload);
          }

          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
        } catch {
          // Malformed message — ignore
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        if (this.clients.size === 0) {
          this.emit('client-disconnected');
        }
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    this.wss.on('error', (err) => {
      console.error('[WS Server] Error:', err.message);
    });

    console.log(`[WS Server] Listening on ws://localhost:${this.port}`);
  }

  hasClients() {
    return this.clients.size > 0;
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  stop() {
    if (this.wss) {
      for (const client of this.clients) {
        client.close();
      }
      this.clients.clear();
      this.wss.close();
      this.wss = null;
    }
  }
}

module.exports = { WebSocketServer };
