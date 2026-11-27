const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzNLQko4UFVGc0hIR1lHVEJseEdmZ0VLazd4TSJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

const req = https.request('https://www.aurasutra.org/api/patient/adherence', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  let total = 0;
  let body = '';
  res.on('data', chunk => {
    total += chunk.length;
    console.log(`Received chunk: ${chunk.length} bytes (total: ${total})`);
    if (body.length < 1000) body += chunk.toString();
  });
  res.on('end', () => {
    console.log('Finished stream! Total bytes:', total);
    console.log('Preview:', body.slice(0, 300));
  });
});

req.on('error', console.error);
req.end();
