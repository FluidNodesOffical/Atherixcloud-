# AtherixCloud Advanced Status Bot

A powerful Discord bot designed to monitor AtherixCloud services, including Convoy Panel and Minecraft Panel.  
Features a full admin system, auto-refreshing status messages, 20+ commands, and persistent data storage.

---

## 🚀 Features

- Real-time monitoring for:
  - Convoy Panel
  - Minecraft Panel
- Auto-refresh every **5 seconds** (customizable)
- Admin system with:
  - Add/remove admins
  - Main protected admin (cannot be removed): `1163301364009541764`
- 20+ admin & utility commands
- Slash commands + prefix commands
- Automatic JSON data storage:
  - `data/admins.json`
  - `data/sites.json`
  - `data/state.json`
- Full embed-based status messages
- Clean file structure
- Error logging & retry system

---

## 📁 Project Structure

```
.
├── index.js
├── package.json
├── .env.example
├── commands/
├── events/
├── handlers/
└── data/
```

---

## 🛠 Installation

### 1. Install Node.js

```bash
sudo apt update
sudo apt install -y nodejs npm
```

### 2. Extract or Clone

```bash
unzip atherix-status-bot.zip
cd atherix-status-bot
```

### 3. Install Dependencies

```bash
npm install
```

---

## ⚙️ Configuration

### Create `.env`

```bash
cp .env.example .env
nano .env
```

Fill in:

```
TOKEN=YOUR_BOT_TOKEN
CHANNEL_ID=STATUS_CHANNEL_ID
REFRESH_INTERVAL=5000
```

---

## ▶️ Running the Bot

### Start Normally:

```bash
node index.js
```

### Recommended – PM2 Auto Restart:

```bash
npm install pm2 -g
pm2 start index.js --name "atherix-status"
pm2 save
pm2 startup
```

---

## 👑 Admin System

### Main Admin (protected):
```
1163301364009541764
```

### Add Admin

Slash:
```
/status addadmin <user_id>
```

Prefix:
```
!addadmin <user_id>
```

### Remove Admin

Slash:
```
/status removeadmin <user_id>
```

Prefix:
```
!removeadmin <user_id>
```

### List Admins

```
/status admins
```

---

## 🌐 Monitor Commands

### Add Site

Slash:
```
/status addsite <url>
```

Prefix:
```
!addsite <url>
```

### Remove Site

```
/status removesite <url>
```

### View Sites

```
/status sites
```

---

## 📊 Status Commands

```
/status refresh
/status enable
/status disable
/ping
/uptime
/status restart
```

---

## 📝 Notes

- Bot auto-checks sites every X seconds (default 5s).
- Status messages are **full embed style**.
- All data is persistent in `/data` folder.

---

## ❤️ Support

AtherixCloud Advanced Status Bot  
Created for premium panel monitoring and uptime tracking.
