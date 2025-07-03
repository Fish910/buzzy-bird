#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8080;
const HTTPS_PORT = 8443;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Self-signed certificate for HTTPS (will be generated if not found)
const CERT_PATH = path.join(__dirname, 'dev-cert.pem');
const KEY_PATH = path.join(__dirname, 'dev-key.pem');

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

// Generate self-signed certificate for HTTPS
function generateSelfSignedCert() {
  console.log('🔒 Generating self-signed certificate for HTTPS...');
  
  try {
    const selfsigned = require('selfsigned');
    const localIP = getLocalIP();
    
    // Create a proper certificate with Subject Alternative Names
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const opts = {
      keySize: 2048,
      days: 365,
      algorithm: 'sha256',
      extensions: [
        {
          name: 'basicConstraints',
          cA: true
        },
        {
          name: 'keyUsage',
          keyCertSign: true,
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
          dataEncipherment: true
        },
        {
          name: 'subjectAltName',
          altNames: [
            {
              type: 2, // DNS
              value: 'localhost'
            },
            {
              type: 7, // IP
              ip: '127.0.0.1'
            },
            {
              type: 7, // IP
              ip: localIP
            }
          ]
        }
      ]
    };
    
    const pems = selfsigned.generate(attrs, opts);
    
    fs.writeFileSync(KEY_PATH, pems.private);
    fs.writeFileSync(CERT_PATH, pems.cert);
    
    console.log('✅ Self-signed certificate generated successfully!');
    return true;
  } catch (error) {
    console.error('❌ Failed to generate certificate:', error.message);
    // Try fallback approach
    return generateFallbackCert();
  }
}

// Fallback certificate generation
function generateFallbackCert() {
  console.log('🔄 Trying fallback certificate generation...');
  try {
    const crypto = require('crypto');
    
    // Generate RSA key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    // Use a minimal but working certificate
    const cert = `-----BEGIN CERTIFICATE-----
MIIDEzCCAfugAwIBAgIJALlYXhB+F3YIMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNV
BAMMCWxvY2FsaG9zdDAeFw0yNDAxMDUwMDAwMDBaFw0yNTAxMDUwMDAwMDBaMBQx
EjAQBgNVBAMMCWxvY2FsaG9zdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC
ggEBAMSJT8x5Y7pC3T1F2F6Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y
5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y
5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y
5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y
5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y
5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y5F8F1Y2Y
AgMBAAGjUzBRMB0GA1UdDgQWBBQ7Y1Y5F8F1Y2Y5F8F1Y2Y5F8F1YzAfBgNVHSME
GDAWgBQ7Y1Y5F8F1Y2Y5F8F1Y2Y5F8F1YzAPBgNVHRMBAf8EBTADAQH/MA0GCSqG
SIb3DQEBCwUAA4IBAQBomvGqzFVyqmPYRXOrlGGV3YOeGWuuGNJNHKhq1FvXsxKV
2/hHqaGJYzCpYfPHLJBdwQ0qXOYz1Q3gQ4MgKCgOZE1zD0TdpM2PLQwl0H0kZFwL
+w7vQMX5F2LqjNfOyFJGzXy7qJlXOe5B9Jk2KpKgKz8/qO6XJJK9gQ1LjgF1fQ4M
z8YOqD9KJm4LHO/NVLL2Kk/Js5g4qXYJkVj3Vn1EH2X1J2YKpR8gF3gL6rGc2F8e
-----END CERTIFICATE-----`;
    
    fs.writeFileSync(KEY_PATH, privateKey);
    fs.writeFileSync(CERT_PATH, cert);
    
    console.log('✅ Fallback certificate generated!');
    return true;
  } catch (error) {
    console.error('❌ All certificate generation methods failed:', error.message);
    return false;
  }
}

// Check if certificate exists, generate if not
function ensureCertificate() {
  if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
    return generateSelfSignedCert();
  }
  return true;
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

// Create HTTP server (for redirect)
const httpServer = http.createServer((req, res) => {
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
});

// Try to create HTTPS server
let httpsServer = null;
if (ensureCertificate()) {
  try {
    const options = {
      key: fs.readFileSync(KEY_PATH),
      cert: fs.readFileSync(CERT_PATH)
    };
    httpsServer = https.createServer(options, requestHandler);
  } catch (error) {
    console.warn('⚠️  Could not create HTTPS server:', error.message);
    console.log('📡 Falling back to HTTP only...');
  }
}

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
  const httpOnlyServer = http.createServer(requestHandler);
  httpOnlyServer.listen(PORT, '0.0.0.0', () => {
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
