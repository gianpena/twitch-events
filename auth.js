import express from 'express';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import { configDotenv } from 'dotenv';

const app = express();
configDotenv();

app.get('/', async (req, res) => {
  const { code } = req.query;
  if(!code) {
    return res.status(400).send('Missing code parameter');
  }
  console.log(`[AUTH] Received code: ${code}`);

  const auth_response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.REDIRECT_URI
    })
  });

  const auth_data = await auth_response.json();
  return res.status(auth_response.status).json(auth_data);
});

app.get('/refresh', async (req, res) => {
  const { refresh_token } = req.query;
  if(!refresh_token) {
    return res.status(400).send('Missing refresh_token parameter');
  }
  console.log(`[AUTH] Refreshing token with refresh_token: ${refresh_token}`);
  const refresh_response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      refresh_token,
      grant_type: 'refresh_token'
    })
  });

  const refresh_data = await refresh_response.json();
  return res.status(refresh_response.status).json(refresh_data);
});


const httpsOptions = {
  key: fs.readFileSync('./ssl/private-key.pem'),
  cert: fs.readFileSync('./ssl/certificate.pem')
};
const httpsServer = https.createServer(httpsOptions, app);
app.use(cors());
app.use(express.json());

httpsServer.listen(443, () => {
  console.log(`HTTPS Server running on port 443`);
});