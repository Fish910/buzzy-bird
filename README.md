# Buzzy Bird (Pitch Bird)
Musical version of flappy bird where the height of the bird is controlled by pitch!

## 🚀 Development Server

### Quick Start
1. **Start the development server:**
   ```bash
   node dev-server.js
   ```
   Or double-click `start-dev-server.bat` on Windows

2. **Access on your phone:**
   - Make sure your phone is connected to the same Wi-Fi network
   - Open the URL shown in the terminal (e.g., `http://192.168.1.100:8080`)

3. **Live reload is enabled!** 
   - Edit any file in the `public/` directory
   - Changes will automatically refresh on your phone

### Features
- ✅ **Phone Access**: Access from any device on your network
- ✅ **Live Reload**: Automatic refresh when files change
- ✅ **No Cache**: Always serves fresh content
- ✅ **SPA Support**: Proper routing for single-page applications

### Alternative Methods
- **Simple Python server**: `python -m http.server 8000` (localhost only)
- **VS Code Task**: Use the "Start Local Server" task

### Troubleshooting
- **Can't access from phone?** Make sure both devices are on the same Wi-Fi network
- **Firewall blocking?** Allow Node.js through Windows Firewall
- **IP not showing?** Check your network connection

## 🎮 Game Features
- Voice/instrument controlled bird flight
- Pitch detection using ml5.js
- Customizable skins and themes
- Firebase leaderboard integration
- PWA support for mobile installation
