# AtherixCloud Advanced Status Bot

A lightweight, fast Discord bot designed to monitor AtherixCloud services (Convoy & MC Panel).  
This version is optimized into **only 3 files**:

```
index.js
package.json
.env
```

Clean, compact, and easy to deploy.

---

## 🚀 Features

- Auto-refresh panel status every 5 seconds
- Monitors:
  - Convoy Panel (https://vms.saturnnode.qzz.io)
  - MC Panel (https://fp.cherrymc.fun)
- Admin system (add/remove admins)
- Main protected admin:
  ```
  1163301364009541764
  ```
- Slash + Prefix commands
- Full embed responses
- Easy configuration
- Zero bloat — only 3 files needed

---

## 📦 Files

### **index.js**
The full bot logic:
- Status checker  
- Embed system  
- Admin system  
- Commands  
- Auto-refresh  
- Update loop  

### **package.json**
Node dependencies:
- discord.js
- node-fetch
- dotenv

### **.env**
Bot configuration.

---

## ⚙️ Setup Guide

### **1. Install Node.js**
```bash
sudo apt update
sudo apt install -y nodejs npm
```

---

### **2. Install Bot Dependencies**
```bash
npm install
```

---

### **3. Configure the Bot**
Copy template (if needed):
```bash
cp .env.example .env
```

Open `.env`:

```bash
nano .env
```

Fill:

```
TOKEN=YOUR_BOT_TOKEN
CHANNEL_ID=STATUS_CHANNEL_ID
REFRESH_INTERVAL=5000
```

Save with:
**CTRL + X → Y → ENTER**

---

## ▶️ Starting the Bot

### Normal:
```bash
node index.js
```

### Recommended (Auto-Restart):
```bash
npm install -g pm2
pm2 start index.js --name "atherix-status"
pm2 save
pm2 startup
```

---

## 👑 Admin Commands

### Add Admin
```
/addadmin <user_id>
!addadmin <user_id>
```

### Remove Admin
```
/removeadmin <user_id>
!removeadmin <user_id>
```

### List Admins
```
/admins
```

Main admin **cannot be removed**:
```
1163301364009541764
```

---

## 🌐 Status Commands

```
/status
/status refresh
/status enable
/status disable
```

---

## 🧭 Utility Commands

```
/ping
/uptime
/help
```

---

## 📝 Notes

- This version is designed to be extremely simple.
- All messages are embeds.
- Everything runs inside **index.js**.
- No external folders needed.
- Perfect for small VPS / low-resource systems.

---

## ❤️ AtherixCloud Status Bot
Fast, minimal, professional monitoring.
