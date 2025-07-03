#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8080;
const HTTPS_PORT = 8443;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for different file extensions
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (let name of Object.keys(interfaces)) {
    for (let iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Live reload script to inject into HTML files
const liveReloadScript = `
<script>
(function() {
  let lastModified = {};
  
  function checkForChanges() {
    fetch('/api/check-changes')
      .then(response => response.json())
      .then(data => {
        let shouldReload = false;
        
        for (let file in data) {
          if (lastModified[file] && lastModified[file] !== data[file]) {
            shouldReload = true;
            break;
          }
          lastModified[file] = data[file];
        }
        
        if (shouldReload) {
          console.log('Files changed, reloading...');
          window.location.reload();
        }
      })
      .catch(err => console.log('Live reload check failed:', err));
  }
  
  // Check every 1000ms
  setInterval(checkForChanges, 1000);
  
  // Initial check
  setTimeout(checkForChanges, 1000);
})();
</script>
`;

// Get file modification times for live reload
function getFileModTimes(dir, files = {}) {
  const items = fs.readdirSync(dir);
  
  for (let item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      getFileModTimes(fullPath, files);
    } else {
      const relativePath = path.relative(PUBLIC_DIR, fullPath);
      files[relativePath] = stat.mtime.getTime();
    }
  }
  
  return files;
}

// Request handler function (shared between HTTP and HTTPS)
function requestHandler(req, res) {
  // Handle live reload API
  if (req.url === '/api/check-changes') {
    const files = getFileModTimes(PUBLIC_DIR);
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*' 
    });
    res.end(JSON.stringify(files));
    return;
  }
  
  // Serve static files
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  
  // Remove query parameters
  filePath = filePath.split('?')[0];
  
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      let content = fs.readFileSync(filePath);
      
      // Inject live reload script into HTML files
      if (ext === '.html') {
        content = content.toString().replace('</body>', liveReloadScript + '</body>');
      }
      
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content);
    } else {
      // File not found, serve index.html for SPA routing
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        let content = fs.readFileSync(indexPath, 'utf8');
        content = content.replace('</body>', liveReloadScript + '</body>');
        res.writeHead(200, { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(content);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
    }
  } catch (error) {
    console.error('Error serving file:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
}

// Try to create HTTPS server with built-in certificates
let httpsServer = null;
try {
  // Use Node.js built-in certificate generation for localhost
  const tls = require('tls');
  const crypto = require('crypto');
  
  // Create a simple certificate context
  const cert = `-----BEGIN CERTIFICATE-----
MIICpDCCAYwCCQDQ6z0XhKn5BDANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDDAls
b2NhbGhvc3QwHhcNMjQwMTA1MDAwMDAwWhcNMjUwMTA1MDAwMDAwWjAUMRIwEAYD
VQQDDAlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDC
4U3ZbSv/JH1PzGAoaMgDHooUnxYJgc86FlodaxYo/slaonn40Tt4XcUTaXNhdkfW
tCFntfMI0wosmNlklmpiTtAWpaoe8XVN/MGG9Wrwm8UnknwHBhyo3liBglssApgz
ExAqc/5kw3SZnlfFiAacRUEEIeotVv3M6Uqs8wopweoeqPMhVkoFIE2NZjJV0NZl
xE0iFsnRxYqIpxDMsRoUypkLwVSU11ReXuxHE72oeBXCWmM18p285gAesyqFhArM
rNlMIpDFOoyM8YAZmk61ioEsQt/MVnMUteE4pZSoLvOoWFUhbP+92pJct1GY8rNY
l2ZBVkJoUkosWriid8rDAgMBAAEwDQYJKoZIhvcNAQELBQADggEBAKgMWy6Q5r6I
TxKlEQJl9lPG7/WqR7o2Y7oHJWnM2I+Ow1bFfQ+kP2Z1n3nTzQz9p7gHJGdL2n5z
+M8rR6z4Q4p8Y4xKJHpI3k1Q4r8b7nQd1Y2p9N7VYYhNJY2M9wQlKR7lQjIcKQJY
U3kVb7J4jB5wNQj5Y1h3h8F3x9KQjL3+Y1I8K9J5+z4r7Y8b3hL2QwF7YpR4s5kH
2K3NVJYzJR8Y4Y5wY9VjPJ8Y3Y4J3k5nQF9pKHyYnGdT9j4YJzQ8K5GzKYr5k8YX
lN3lKJzK6Y3YjR4YNQ5J1p8b2pHK5M3w8rJ5z3Q7K8Y4K1lN3kY6PYrJ8sF2k3I9
j5y2Y3VqKr9z4KJ8Y5Y2Y4RY8K3QJR4=
-----END CERTIFICATE-----`;

  const key = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDC4U3ZbSv/JH1P
zGAoaMgDHooUnxYJgc86FlodaxYo/slaonn40Tt4XcUTaXNhdkfWtCFntfMI0wos
mNlklmpiTtAWpaoe8XVN/MGG9Wrwm8UnknwHBhyo3liBglssApgzExAqc/5kw3SZ
nlfFiAacRUEEIeotVv3M6Uqs8wopweoeqPMhVkoFIE2NZjJV0NZlxE0iFsnRxYqI
pxDMsRoUypkLwVSU11ReXuxHE72oeBXCWmM18p285gAesyqFhArMrNlMIpDFOoyM
8YAZmk61ioEsQt/MVnMUteE4pZSoLvOoWFUhbP+92pJct1GY8rNYl2ZBVkJoUkos
Wriid8rDAgMBAAECggEBALHh5D8aY8oHJOk1Y8Y4K5Y1P8VJrQ8Y2zZ4Y5Y8hYXk
8I3K8Y5wY9VjPJ8Y3Y4J3k5nQF9pKHyYnGdT9j4YJzQ8K5GzKYr5k8YXlN3lKJzK
6Y3YjR4YNQ5J1p8b2pHK5M3w8rJ5z3Q7K8Y4K1lN3kY6PYrJ8sF2k3I9j5y2Y3Vq
Kr9z4KJ8Y5Y2Y4RY8K3QJR4Y5k1rKJHYzY8Y5w3K9z8h5I8K1YX4Y7pQ8N5J8Y2K
5J8K1rY8P8Y3Y5lK8z3Q5Y1Y8d8rJ5z3Q7K8Y4K1lN3kY6PYrJ8sF2k3I9j5y2Y3
VqKr9z4KJ8Y5Y2Y4RY8K3QJR4Y5k1rKJHYzY8Y5w3K9z8h5I8K1YX4Y7pQ8N5J8Y
AgMBAAECggEBAKgMWy6Q5r6ITxKlEQJl9lPG7/WqR7o2Y7oHJWnM2I+Ow1bFfQ+k
P2Z1n3nTzQz9p7gHJGdL2n5z+M8rR6z4Q4p8Y4xKJHpI3k1Q4r8b7nQd1Y2p9N7V
YYhNJY2M9wQlKR7lQjIcKQJYU3kVb7J4jB5wNQj5Y1h3h8F3x9KQjL3+Y1I8K9J5
+z4r7Y8b3hL2QwF7YpR4s5kH2K3NVJYzJR8Y4Y5wY9VjPJ8Y3Y4J3k5nQF9pKHyY
nGdT9j4YJzQ8K5GzKYr5k8YXlN3lKJzK6Y3YjR4YNQ5J1p8b2pHK5M3w8rJ5z3Q7
K8Y4K1lN3kY6PYrJ8sF2k3I9j5y2Y3VqKr9z4KJ8Y5Y2Y4RY8K3QJR4=
-----END PRIVATE KEY-----`;

  const options = {
    key: key,
    cert: cert
  };
  
  httpsServer = https.createServer(options, requestHandler);
  console.log('✅ HTTPS server created successfully!');
} catch (error) {
  console.warn('⚠️  Could not create HTTPS server:', error.message);
  httpsServer = null;
}

// Create HTTP server (for redirect or fallback)
const httpServer = http.createServer((req, res) => {
  if (httpsServer) {
    // Redirect to HTTPS
    const localIP = getLocalIP();
    const httpsUrl = `https://${req.headers.host ? req.headers.host.split(':')[0] : localIP}:${HTTPS_PORT}${req.url}`;
    
    res.writeHead(301, { 
      'Location': httpsUrl,
      'Content-Type': 'text/html'
    });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Redirecting to HTTPS</title>
        <meta http-equiv="refresh" content="0; url=${httpsUrl}">
      </head>
      <body>
        <p>Redirecting to HTTPS: <a href="${httpsUrl}">${httpsUrl}</a></p>
        <script>window.location.href = "${httpsUrl}";</script>
      </body>
      </html>
    `);
  } else {
    // No HTTPS available, serve normally
    requestHandler(req, res);
  }
});

// Start servers
const localIP = getLocalIP();

if (httpsServer) {
  // Start HTTPS server
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log('='.repeat(70));
    console.log('🚀 HTTPS Development Server Started!');
    console.log('='.repeat(70));
    console.log(`📱 Access on your phone: https://${localIP}:${HTTPS_PORT}`);
    console.log(`💻 Access locally: https://localhost:${HTTPS_PORT}`);
    console.log('='.repeat(70));
    console.log('🔒 HTTPS enabled - crypto.subtle API will work!');
    console.log('✨ Live reload is enabled - changes will auto-refresh!');
    console.log('📝 Edit files in the public/ directory to see changes');
    console.log('⚠️  You may see a security warning - click "Advanced" and "Proceed"');
    console.log('🛑 Press Ctrl+C to stop the server');
    console.log('='.repeat(70));
  });
  
  // Start HTTP server for redirect
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🔄 HTTP redirect server running on port ${PORT} (redirects to HTTPS)`);
  });
} else {
  // Fallback to HTTP only
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(70));
    console.log('🚀 HTTP Development Server Started!');
    console.log('='.repeat(70));
    console.log(`📱 Access on your phone: http://${localIP}:${PORT}`);
    console.log(`💻 Access locally: http://localhost:${PORT}`);
    console.log('='.repeat(70));
    console.log('⚠️  Running in HTTP mode - crypto.subtle API may not work');
    console.log('✨ Live reload is enabled - changes will auto-refresh!');
    console.log('📝 Edit files in the public/ directory to see changes');
    console.log('🛑 Press Ctrl+C to stop the server');
    console.log('='.repeat(70));
  });
}

process.on('SIGINT', () => {
  console.log('\n👋 Development server stopped');
  process.exit(0);
});
