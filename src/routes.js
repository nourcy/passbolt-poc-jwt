const ApiClient = require('./apiClient');
const { v4: uuidv4 } = require('uuid');
const { dateUtil } = require('./utils/date');
const fs = require('fs');
const path = require('path');
const { openPGPService } = require('./services/openpgp.service');
const apiClient = new ApiClient();

exports.routes = {
    '/login': {
        POST: (req, res) => {
            console.log(`Request to login`);
            let body = [];
            req.on('data', chunk => {
                body.push(chunk);
            })
            .on('end', async () => {
                // Get data from request body
                // Uncomment it if you prefer to request it 
                // const { passphrase } = JSON.parse(body);
                // Get passphrase from env var
                // Comment it if you prefer to send the passphrase by http request
                const passphrase = process.env.PASSPHRASE;

                // Retrieve keyData from the server
                const { keydata } = (await apiClient.verify()).body;

                // Save the keydata to a file for later use
                fs.writeFileSync(path.resolve(__dirname, 'publicKey.asc'), keydata);
                
                // Set the public key in the environment variable
                process.env.PUBLIC_KEY = keydata;

                // Build the challenge for authentication
                const loginChallenge = {
                    "version": "1.0.0",
                    "domain": process.env.TRUSTED_DOMAIN,
                    "verify_token": uuidv4(),
                    // current timestamp + lifetime (2mins)
                    "verify_token_expiry": dateUtil.expiryTimestamp(),
                };
                
                // Encrypt the challenge with the public server key and sign it with the private key
                const encryptedChallenge = await openPGPService.encrypt(JSON.stringify(loginChallenge), passphrase);
                // Send encrypted pgp message
                const result = await apiClient.login({ user_id: process.env.USER_ID, challenge: encryptedChallenge });
                
                res.writeHead(result.status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(apiClient));               
            });
        }
    },
    '/resources': {
        GET: async (req, res) => {
            console.log(`Request to get resources`);
            const result = await apiClient.fetchToApi("resources.json");
            res.writeHead(result.header.code, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.body));               
        }
    },
    '/folders': {
        GET: async (req, res) => {
            console.log(`Request to get resources`);
            const result = await apiClient.fetchToApi("folders.json");
            res.writeHead(result.header.code, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.body));               
        }
    },
    '/folders': {
        POST: async (req, res) => {
            console.log(`Request to get resources`);
            const { name } = req.body; // Extract the folder name from the request body
            const result = await apiClient.fetchToApi("folders.json");
            const folders = result.body; // Assuming the fetched result has the folders in the body
            const matchingFolder = folders.find(folder => folder.name === name);

            if (matchingFolder) {
                res.status(200).json(matchingFolder);
            } else {
                res.status(404).json({ error: 'Folder not found' });
            }
            // res.writeHead(result.header.code, { 'Content-Type': 'application/json' });
            // res.end(JSON.stringify(result.body));               
        }
    },
    '/groups': {
        GET: async (req, res) => {
            console.log(`Request to get resources`);
            const result = await apiClient.fetchToApi("groups.json");
            res.writeHead(result.header.code, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.body));               
        }
    },
    '/users': {
        GET: async (req, res) => {
            console.log(`Request to get resources`);
            const result = await apiClient.fetchToApi("users.json");
            res.writeHead(result.header.code, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.body));               
        }
    },
    '/refresh': {
        POST: async (req, res) => {
            console.log(`Request to refresh token`);
            const result = await apiClient.refresh();
            res.writeHead(result.status, { 'Content-Type': 'application/json' });
            res.end(result.status.OK ? "Tokens refreshed" : result.headers.message);               
        }
    },
    '/logout': {
        POST: async (req, res) => {
            console.log(`Request to logout`);
            const result = await apiClient.fetchToApi("/auth/jwt/logout.json", {
                method: 'POST'
            });
            res.writeHead(result.header.code, { 'Content-Type': 'application/json' });
            // Remove data from memory
            apiClient.accessToken = null;
            apiClient.refreshToken = null;
            res.writeHead(result.header.code, { 'Content-Type': 'application/json' });
            res.end(result.header.code === "200" ? "Logout" : result.header.message);               
        }
    }
};
