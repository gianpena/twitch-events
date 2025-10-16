import { WebSocket } from 'ws';
import { configDotenv } from 'dotenv';

configDotenv();

const TWITCH_BASE_URL = 'wss://eventsub.wss.twitch.tv/ws';

class TwitchClientConnection {
  constructor() {
    this.ws = null
    this.session_id = null;
    this.reconnecting = false;
  }

  connect(URL) {
    const newConnection = new WebSocket(URL);

    newConnection.on('message', data => {
      const json = JSON.parse(data);
      const { metadata, payload } = json;

      if(metadata.message_type === 'session_welcome') {
        console.log(`[TWITCH] Session established with ID ${payload.session.id}`);
        if(this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.close();
        }
        console.log('[CLIENT] Updating client state with new session info...');
        this.ws = newConnection;
        this.session_id = payload.session.id;
        this.reconnecting = false;
        console.log('[CLIENT] Done. Subscribing to events in 2 seconds...');
        setTimeout(() => {
          this.subscribe();
        }, 2000);
      } else this.handleMessage(json);
    });

    newConnection.on('open', () => {
      console.log('Connection established');
    });

    newConnection.on('close', () => {
      if(!this.reconnecting) {
        if(this.ws) {
          if (this.ws.readyState === WebSocket.OPEN) this.ws.close();
          this.ws = null;
        }
        this.connect(TWITCH_BASE_URL);
      }
    });
    
  }

  handleMessage(json) {
    // handling anything except session_welcome
    const { metadata, payload } = json;
    if (metadata.message_type === 'session_reconnect') {
      this.reconnecting = true;
      this.connect(payload.session.reconnect_url);
      return;
    }
    if (metadata.message_type !== 'notification') return;

    console.log('[TWITCH] xQc went live!');

  }

  async subscribe() {

    const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`, 
        'Client-Id': process.env.CLIENT_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "type": "stream.online",
        "version": "1",
        "condition": {
          "broadcaster_user_id": process.env.BROADCASTER
        },
        "transport": {
          "method": "websocket",
          "session_id": this.session_id
        }
      })
    });

    console.log(`[CLIENT] Subscription request processed with status ${response.status}`);
    if(!response.ok) {
      const eventSubData = await response.json();
      console.error('[CLIENT] Failed to subscribe to event:', eventSubData);
    }

  }
}

const client = new TwitchClientConnection();
client.connect(TWITCH_BASE_URL);