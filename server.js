const querystring = require('querystring');
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const apiBaseUrl = 'https://services.test.frejaeid.com';

const pfxPath = './Bonnier_News.pfx'; // 
const pfxPassphrase = ''; // 

async function post(url, data) {
  const encodedData = Buffer.from(JSON.stringify(data)).toString('base64');
  const requestBody = `initAuthRequest=${encodedData}`;

  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    pfx: fs.readFileSync(pfxPath),
    httpsAgent: new https.Agent({
      passphrase: pfxPassphrase,
    }),
  };

  try {
    const response = await axios.post(apiBaseUrl + url, requestBody, requestOptions);
    return response.data;
  } catch (error) {
    console.error(`Error in POST request: ${error}`);
    throw error;
  }
}

async function createAuthRequest(personnummer) {
  const formattedPersonnummer = personnummer.slice(0, 8) + '-' + personnummer.slice(8);
  const POST_DATA = {
    userInfoType: 'SSN',
    userInfo: {
      country: 'SE',
      ssn: formattedPersonnummer,
    },
    minRegistrationLevel: 'BASIC',
  };

  const encodedData = Buffer.from(JSON.stringify(POST_DATA)).toString('base64');
  const requestBody = `initAuthRequest=${encodedData}`;
  console.log('Request Body:', requestBody);

  const url = '/authentication/1.0/initAuth';
  console.log('Request URL:', apiBaseUrl + url);

  return post(url, POST_DATA);
}
// Define routes
app.get('/', (req, res) => {
  res.send('Welcome to the Freja eID login example');
});

app.post('/freja', async (req, res) => {
  const personnummer = req.body.personnummer;

  if (!personnummer) {
    res.status(400).send('Personnummer is required');
    return;
  }

  console.log('Personnummer:', personnummer); //debug 

  try {
    const response = await createAuthRequest(personnummer);
    const authRef = response.authRef;
    console.log('Freja eID response:', response); // debug 
    res.json({ authRef: authRef });
  } catch (error) {
    console.error('Error creating auth request:', error);
    res.status(500).send('Error creating auth request');
  }
});

app.post('/freja/callback', async (req, res) => {
  const authRef = req.body.authRef;

  if (!authRef) {
    res.status(400).send('AuthRef is required');
    return;
  }

  try {
    const authResult = await getAuthResult(authRef);

    if (authResult.status === 'APPROVED') {
      const userInfo = {
        email: authResult.details.userInfo,
      };

      // User authenticated successfully, generate a JWT token and return it to the user
      const token = jwt.sign(userInfo, 'your_jwt_secret', { expiresIn: '1h' });
      res.json({ success: true, token: token });
    } else {
      res.status(401).send('Authentication failed');
    }
  } catch (error) {
    console.error('Error processing auth result:', error);
    res.status(500).send('Error processing auth result');
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});