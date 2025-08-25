# Google VPS Deployment Guide for NZI Coin Backend

## Prerequisites
- Google Cloud Platform account
- Domain name (optional but recommended)
- Basic Linux command knowledge

## Step 1: Create Google Compute Engine Instance

### 1.1 Create VM Instance
```bash
# Option 1: Using gcloud CLI
gcloud compute instances create nzi-coin-server \
    --zone=us-central1-a \
    --machine-type=e2-micro \
    --subnet=default \
    --network-tier=PREMIUM \
    --maintenance-policy=MIGRATE \
    --image=ubuntu-2204-jammy-v20231030 \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=20GB \
    --boot-disk-type=pd-standard \
    --boot-disk-device-name=nzi-coin-server \
    --tags=http-server,https-server

# Option 2: Via Google Cloud Console
# 1. Go to Compute Engine > VM instances
# 2. Click "CREATE INSTANCE"
# 3. Choose these settings:
#    - Name: nzi-coin-server
#    - Region: us-central1, Zone: us-central1-a
#    - Machine type: e2-micro (1GB RAM, good for start)
#    - Boot disk: Ubuntu 22.04 LTS
#    - Firewall: Allow HTTP and HTTPS traffic
```

### 1.2 Configure Firewall Rules
```bash
# Create firewall rule for Node.js app (port 3000)
gcloud compute firewall-rules create allow-nzi-backend \
    --allow tcp:3000 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow NZI Coin backend on port 3000"

# For production, also allow port 80 and 443
gcloud compute firewall-rules create allow-web-traffic \
    --allow tcp:80,tcp:443 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow web traffic"
```

## Step 2: Connect to Your VPS

### 2.1 SSH Connection
```bash
# Option 1: Using gcloud CLI
gcloud compute ssh nzi-coin-server --zone=us-central1-a

# Option 2: Via Google Cloud Console
# Go to Compute Engine > VM instances > Click SSH button

# Option 3: Using external SSH client
# Download private key from Metadata > SSH Keys
# ssh -i ~/.ssh/google_compute_engine username@EXTERNAL_IP
```

## Step 3: Server Setup

### 3.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 3.2 Install Node.js and npm
```bash
# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 3.3 Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

### 3.4 Install Git
```bash
sudo apt install git -y
```

## Step 4: Deploy Backend Application

### 4.1 Create Project Directory
```bash
# Create application directory
sudo mkdir -p /var/www/nzi-coin-backend
sudo chown $USER:$USER /var/www/nzi-coin-backend
cd /var/www/nzi-coin-backend
```

### 4.2 Upload Backend Files
You have several options to upload your backend files:

**Option A: Using SCP (from your local machine)**
```bash
# Upload all backend files to your VPS
scp -r ./backend/* username@EXTERNAL_IP:/var/www/nzi-coin-backend/

# Or upload individual files
scp package.json username@EXTERNAL_IP:/var/www/nzi-coin-backend/
scp server.js username@EXTERNAL_IP:/var/www/nzi-coin-backend/
# ... continue for all files
```

**Option B: Create files manually on server**
```bash
# Create the files using nano/vim
nano package.json
# Copy paste the content from generated files
# Repeat for all files
```

**Option C: Git repository (recommended)**
```bash
# Initialize git repo and push to GitHub/GitLab
# Then clone on server:
git clone https://github.com/yourusername/nzi-coin-backend.git .
```

### 4.3 Create Directory Structure
```bash
# Create necessary directories
mkdir -p routes
mkdir -p database
mkdir -p logs

# Move files to correct locations
mv database_init.js database/init.js
mv auth_routes.js routes/auth.js
mv game_routes.js routes/game.js
mv leaderboard_routes.js routes/leaderboard.js
mv friends_routes.js routes/friends.js
```

### 4.4 Install Dependencies
```bash
npm install
```

### 4.5 Configure Environment
```bash
# Copy and edit environment file
cp .env.example .env
nano .env

# Update these values in .env:
# BOT_TOKEN=your_actual_bot_token_from_botfather
# JWT_SECRET=generate_a_random_secret_key
# PORT=3000
```

## Step 5: Database Setup

### 5.1 Initialize Database
```bash
# Create database directory
mkdir -p database
node database/init.js
```

## Step 6: Start the Application

### 6.1 Test Run
```bash
# Test the application
npm start

# Check if it's working (in another terminal)
curl http://localhost:3000/health
```

### 6.2 Production Deployment with PM2
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs nzi-coin-backend

# Restart if needed
pm2 restart nzi-coin-backend
```

### 6.3 Auto-start PM2 on Boot
```bash
# Generate startup script
pm2 startup
# Run the command it outputs (usually starts with sudo)

# Save current PM2 processes
pm2 save
```

## Step 7: SSL/HTTPS Setup (Production)

### 7.1 Install Nginx (Recommended)
```bash
sudo apt install nginx -y

# Create Nginx config
sudo nano /etc/nginx/sites-available/nzi-coin-backend

# Add this configuration:
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable the site
sudo ln -s /etc/nginx/sites-available/nzi-coin-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7.2 Install SSL with Let's Encrypt
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## Step 8: Monitoring and Maintenance

### 8.1 View Application Logs
```bash
# PM2 logs
pm2 logs nzi-coin-backend

# System logs
sudo journalctl -u nginx -f

# Check disk space
df -h

# Check memory usage
free -m

# Check running processes
pm2 status
```

### 8.2 Backup Database
```bash
# Create backup script
nano backup.sh

#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp /var/www/nzi-coin-backend/nzi_coin.db /var/www/nzi-coin-backend/backups/nzi_coin_$DATE.db
find /var/www/nzi-coin-backend/backups -name "*.db" -mtime +7 -delete

chmod +x backup.sh

# Add to crontab for daily backup
crontab -e
# Add: 0 2 * * * /var/www/nzi-coin-backend/backup.sh
```

## Step 9: Update Application

### 9.1 Update Process
```bash
cd /var/www/nzi-coin-backend

# Pull latest changes (if using git)
git pull origin main

# Install new dependencies
npm install

# Restart application
pm2 restart nzi-coin-backend
```

## Step 10: Frontend Integration

### 10.1 Update Frontend API Endpoints
```javascript
// In your frontend app.js, change API calls to:
const API_BASE_URL = 'https://your-domain.com/api'; // or http://YOUR_VPS_IP:3000/api

// Example API call:
async function saveProgress(gameData) {
    const response = await fetch(`${API_BASE_URL}/game/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameData)
    });
    return response.json();
}
```

## Troubleshooting

### Common Issues:

1. **Port 3000 not accessible:**
   ```bash
   # Check firewall
   sudo ufw status
   sudo ufw allow 3000
   
   # Check if app is running
   pm2 status
   netstat -tlnp | grep :3000
   ```

2. **Database permission errors:**
   ```bash
   # Fix ownership
   sudo chown -R $USER:$USER /var/www/nzi-coin-backend
   chmod 755 /var/www/nzi-coin-backend
   ```

3. **Memory issues:**
   ```bash
   # Check memory
   free -m
   
   # Add swap if needed
   sudo fallocate -l 1G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

## Security Best Practices

1. **Firewall Configuration:**
   ```bash
   sudo ufw enable
   sudo ufw allow ssh
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw allow 3000  # Only if not using nginx proxy
   ```

2. **Regular Updates:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   npm audit fix
   ```

3. **Monitor Logs:**
   ```bash
   # Check for suspicious activity
   sudo tail -f /var/log/auth.log
   pm2 logs
   ```

Your NZI Coin backend should now be running successfully on Google VPS!

**API Endpoints Available:**
- `GET /health` - Health check
- `POST /api/auth/login` - User authentication
- `POST /api/game/save` - Save game progress
- `GET /api/game/load/:telegram_id` - Load game progress
- `POST /api/game/purchase-booster` - Purchase upgrades
- `GET /api/leaderboard/top/:limit` - Get leaderboard
- `GET /api/leaderboard/rank/:telegram_id` - Get user rank
- `POST /api/friends/add` - Add friend/referral
- `GET /api/friends/list/:telegram_id` - Get friends list