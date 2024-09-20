const fetch = require('node-fetch-native');
const https = require('https');
const {openPGPService} = require('./services/openpgp.service');
const BASE_URL = process.env.TRUSTED_DOMAIN;
const httpsAgent = new https.Agent({
    //Used for development to allow invalid https certificate
    rejectUnauthorized: false,
});

/**
 * Represents a client to interact with the API.
 */
class ApiClient {
    constructor() {
        this.csrfToken = null;
        this.accessToken = null;
        this.refreshToken = null;
    }

    /**
     * Verify the client's status.
     * @returns {Promise<Object>} The response JSON.
     */
    async verify() {
        const response = await fetch(`${BASE_URL}/auth/verify.json`, { agent: httpsAgent });
        return response.json();
    }

    /**
     * Fetch and set the CSRF token.
     * @returns {Promise<void>}
     */
    async getCsrfToken() {
        const response = await fetch(`${BASE_URL}/users/csrf-token.json`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            agent: httpsAgent,
        });
        const json = await response.json();
    
        this.csrfToken = json.body;
    }

    /**
     * Log in and set the access and refresh tokens.
     * @param {Object} body - The login request body.
     * @returns {Promise<Response>} The response object.
     */
    async login(body) {
        const response = await fetch(`${BASE_URL}/auth/jwt/login.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            agent: httpsAgent,
        });
        if(response.status === 200) {
            //Retrieve the csrf token for the POST methods
            await this.getCsrfToken();
            const result = await response.json();
            try {
                const decryptedMessage = await openPGPService.decrypt(result.body.challenge, process.env.PASSPHRASE);
                const challenge = JSON.parse(decryptedMessage);
                this.accessToken = challenge.access_token;
                this.refreshToken = challenge.refresh_token;
                console.log("Refresh token: ", this.refreshToken)
                console.log("Access token: ", this.accessToken)
            } catch (error) {
                console.error('An error occurred during decryption:', error);
                throw new Error('Failed to decrypt the response.');
            }
            
            return response;
        } else {
            console.error(response)
            throw new Error('Unauthorized even after token refresh');
        }
    }

    /**
     * Refresh the access token using the refresh token.
     * @returns {Promise<Response>} The response object.
     */
    async refresh() {
        const response = await fetch(`${BASE_URL}/auth/jwt/refresh.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.csrfToken,
            },
            body: JSON.stringify({
                user_id: process.env.USER_ID,
                refresh_token: this.refreshToken
            }),
            agent: httpsAgent,
        })
        console.log("Old refresh token: ", this.refreshToken)
        console.log("Old access token: ", this.access_token)

        const result = await response.json();
        //We apply the new access token
        this.accessToken = result.body.access_token;
        //We intercept the cookie to renew the refresh token
        const cookieString = response.headers.get('set-cookie');
        const refreshTokenMatch = cookieString.match(/refresh_token=([^;]*)/);
        //We apply the new refresh token
        this.refreshToken = refreshTokenMatch ? refreshTokenMatch[1] : null;
        console.log("New refresh token: ", this.refreshToken)
        console.log("New access token: ", this.access_token)
        return response;
    }

    /**
     * Make a fetch request to the API and handle authentication.
     * @param {string} url - The endpoint URL.
     * @param {Object} [options={}] - Fetch options.
     * @param {boolean} [isRetry=false] - Indicate if this request is a retry.
     * @returns {Promise<Object>} The response JSON.
     * @throws Will throw an error if the request fails after a retry.
     */
    async fetchToApi(url, options = {}, isRetry = false) {
        const response = await fetch(`${BASE_URL}/${url}`, {
            ...options,
            headers: {
                ...options.headers,
                //Only request for POST action, added generic purpose
                'X-CSRF-Token': this.csrfToken,
                'Authorization': `Bearer ${this.accessToken}`
            },
            agent: httpsAgent,
        });
        //If the status is 403 and it is the first, it means that we need to refresh the token
        if (response.status === 403 && !isRetry) {
            await this.refresh();
            return this.fetchToApi(url, options, true);
        }
        //If the status is 403 and we have already retry it, it means we are logout or unauthenticated
        if (response.status === 403 && isRetry) {
            throw new Error('Unauthorized even after token refresh');
        }

        //In other case we have another issue
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json();
    }
}

module.exports = ApiClient;
