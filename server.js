require('dotenv').config();

const { routes } = require('./src/routes');
const fs = require('fs');
const path = require('path');
const http = require('http');


// Retrieve the port from environment variables or default to 3000
const PORT = process.env.PORT || 3000;

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

let server;

/**
 * Create and start the HTTP server.
 */
const startServer = () => {
    server = http.createServer((req, res) => {
        const { method, url } = req;

        // Check if there's a handler for the current method and URL
        const handler = routes[url] && routes[url][method];

        if (handler) {
            // If a handler is found, execute it
            handler(req, res);
        } else {
            // Otherwise, send a 404 Not Found response
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Not Found' }));
        }
    });

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

/**
 * Restart the HTTP server.
 */
const restartServer = () => {
    server.close(() => {
        console.log('Server is restarting...');
        startServer();
    });
};

/**
 * Handle uncaught exceptions by logging the error and restarting the server.
 */
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    restartServer();
});

// Start the server initially
loadPrivateKey();
startServer();
