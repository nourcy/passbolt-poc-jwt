#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
require('dotenv').config();  // Load environment variables as early as possible
const ApiClient = require(path.resolve(__dirname, 'src/apiClient'));
const { v4: uuidv4 } = require('uuid');
const { dateUtil } = require(path.resolve(__dirname, 'src/utils/date'));
const fs = require('fs');
const { openPGPService } = require(path.resolve(__dirname, 'src/services/openpgp.service'));

// Load the private key from a file and set it in process.env
const loadPrivateKey = () => {
    const privateKeyPath = path.join(__dirname, 'private.key'); // Adjust the path as needed
    try {
        const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        process.env.PRIVATE_KEY = privateKey;
    } catch (error) {
        console.error(`Failed to load private key from ${privateKeyPath}:`, error);
        process.exit(1); // Exit the application if the private key can't be loaded
    }
};

const program = new Command();
const apiClient = new ApiClient();

program
  .version('1.0.0')
  .description('CLI tool for JWT authentication and resource fetching');

program
  .command('login')
  .description('Login and retrieve access token')
  .action(async () => {
    try {
      const passphrase = process.env.PASSPHRASE;
      const { keydata } = (await apiClient.verify()).body;

      fs.writeFileSync(path.resolve(__dirname, 'publicKey.asc'), keydata);
      process.env.PUBLIC_KEY = keydata;

      const loginChallenge = {
        "version": "1.0.0",
        "domain": process.env.TRUSTED_DOMAIN,
        "verify_token": uuidv4(),
        "verify_token_expiry": dateUtil.expiryTimestamp(),
      };

      const encryptedChallenge = await openPGPService.encrypt(JSON.stringify(loginChallenge), passphrase);
      const result = await apiClient.login({ user_id: process.env.USER_ID, challenge: encryptedChallenge });

      if (result.status === 200) {
        console.log("Authenticated");
      } else {
        console.error(result.headers.message);
      }
    } catch (error) {
      console.error('Login failed:', error.message);
    }
  });

program
  .command('get-resources')
  .description('Fetch resources')
  .action(async () => {
    try {
      const result = await apiClient.fetchToApi("resources.json");
      console.log(JSON.stringify(result.body, null, 2));
    } catch (error) {
      console.error('Failed to fetch resources:', error.message);
    }
  });

program
  .command('refresh')
  .description('Refresh tokens')
  .action(async () => {
    try {
      const result = await apiClient.refresh();
      console.log(result.status === 200 ? "Tokens refreshed" : result.headers.message);
    } catch (error) {
      console.error('Failed to refresh tokens:', error.message);
    }
  });

program
  .command('logout')
  .description('Logout')
  .action(async () => {
    try {
      const result = await apiClient.fetchToApi("/auth/jwt/logout.json", { method: 'POST' });
      apiClient.accessToken = null;
      apiClient.refreshToken = null;
      console.log(result.status === 200 ? "Logout" : result.headers.message);
    } catch (error) {
      console.error('Logout failed:', error.message);
    }
  });

loadPrivateKey(); // Load the private key before running any commands
program.parse(process.argv);
