const https = require('https');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

const PHONE_NUMBER_ID = "899290049941177";
const ADMIN_PHONE_NUMBER = "919284091637";
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

console.log("Using Token:", ACCESS_TOKEN ? ACCESS_TOKEN.substring(0, 10) + "..." : "MISSING");

if (!ACCESS_TOKEN) {
    console.error("Error: WHATSAPP_ACCESS_TOKEN is missing.");
    process.exit(1);
}

const data = JSON.stringify({
    messaging_product: "whatsapp",
    to: ADMIN_PHONE_NUMBER,
    type: "template",
    template: {
        name: "hello_world",
        language: {
            code: "en_US"
        }
    }
});

const options = {
    hostname: 'graph.facebook.com',
    path: `/v22.0/${PHONE_NUMBER_ID}/messages`,
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
        responseData += chunk;
    });

    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log('Response:', responseData);
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
