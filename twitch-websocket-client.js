import { WebSocket } from 'ws';
import { configDotenv } from 'dotenv';

configDotenv();

const TWITCH_SOCKET_URL = 'wss://eventsub.wss.twitch.tv/ws';
const EVENT_SUB_URL = 'https://api.twitch.tv/helix/eventsub/subscriptions';

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
          this.ws.removeAllListeners(); // Remove old handlers
          this.ws.close();
        }
        console.log('[CLIENT] Updating client state with new session info...');
        this.ws = newConnection;
        this.session_id = payload.session.id;
        this.reconnecting = false;
        
        // Attach close handler ONLY after connection is established
        this.ws.on('close', () => {
          console.log('[CLIENT] Connection closed unexpectedly, reconnecting...');
          this.ws = null;
          this.session_id = null;
          this.connect(TWITCH_SOCKET_URL);
        });
        
        console.log('[CLIENT] Finished updating client state. Subscribing to events in 2 seconds...');
        setTimeout(() => {
          this.subscribe();
        }, 2000);
      } else this.handleMessage(json);
    });

    newConnection.on('open', () => {
      console.log('[CLIENT] Connection established');
    });

  }

  handleMessage(json) {
    // handling anything except session_welcome
    const { metadata, payload } = json;
    if (metadata.message_type === 'session_reconnect') {
      console.log(`[TWITCH] Must reconnect to new URL: ${payload.session.reconnect_url}`);
      console.log('[CLIENT] OK, reconnecting...');
      this.reconnecting = true;
      this.connect(payload.session.reconnect_url);
      return;
    }
    if (metadata.message_type !== 'notification') return;

    console.log('[TWITCH] xQc went live!');

  }

  async subscribe() {

    const response = await fetch(EVENT_SUB_URL, {
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
      const formattedError = JSON.stringify(eventSubData, null, 2)
        .split('\n')
        .map(line => `[CLIENT] ${line}`)
        .join('\n');
      console.error(formattedError);
    }

  }
}

const client = new TwitchClientConnection();
client.connect(TWITCH_SOCKET_URL);