import { WebSocket } from 'ws';
import { configDotenv } from 'dotenv';

configDotenv();

const TWITCH_SOCKET_URL = 'wss://eventsub.wss.twitch.tv/ws';
const EVENT_SUB_URL = 'https://api.twitch.tv/helix/eventsub/subscriptions';
let ACCESS_TOKEN = null;
let REFRESH_TOKEN = null;

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
          this.subscribe({
            "type": "stream.online",
            "version": "1",
            "condition": {
              "broadcaster_user_id": process.env.BROADCASTER
            },
            "transport": {
              "method": "websocket",
              "session_id": this.session_id
            }
          });
          this.subscribe({
            "type": "channel.update",
            "version": "2",
            "condition": {
              "broadcaster_user_id": process.env.BROADCASTER
            },
            "transport": {
              "method": "websocket",
              "session_id": this.session_id
            }
          });

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

    // TODO: update this with actual event handling logic
    console.log(payload.subscription.type);

  }

  async subscribe(body) {

    const response = await fetch(EVENT_SUB_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`, 
        'Client-Id': process.env.CLIENT_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const eventSubData = await response.json();
    const formattedJson = JSON.stringify(eventSubData, null, 2)
      .split('\n')
      .map(line => `[CLIENT] ${line}`)
      .join('\n');
    console.log(formattedJson);

  }
}

const client = new TwitchClientConnection();
console.log(`[CLIENT] Please authorize at https://id.twitch.tv/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&response_type=code&scope=user:read:email.`);
console.log('[CLIENT] Once you are finished, paste the access and refresh tokens here, then press enter.');
process.stdin.once('data', (data) => {
  const [ access, refresh ] = data.toString().trim().split(' ');
  ACCESS_TOKEN = access;
  REFRESH_TOKEN = refresh;
  console.log('[CLIENT] Tokens received');
  console.log(`[CLIENT] Access Token: ${ACCESS_TOKEN}`);
  console.log(`[CLIENT] Refresh Token: ${REFRESH_TOKEN}`);
  console.log('[CLIENT] Starting token refresh interval (1 hour)...');
  setInterval( async () => {
    const refresh_response = await fetch(`https://twitch.gianpena.xyz/refresh?refresh_token=${REFRESH_TOKEN}`);
    const refresh_data = await refresh_response.json();
    const { access_token, refresh_token } = refresh_data;
    if(access_token && refresh_token) {
      ACCESS_TOKEN = access_token;
      REFRESH_TOKEN = refresh_token;
      console.log('[CLIENT] Token refreshed successfully');
    } else {
      console.error('[CLIENT] Failed to refresh token:', refresh_data);
    }
  }, 1000 * 60 * 60);
  console.log('[CLIENT] Connecting to Twitch WebSocket server...');
  client.connect(TWITCH_SOCKET_URL);
});