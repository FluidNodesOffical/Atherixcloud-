#!/bin/bash

# 🌐 AtherixCloud — Professional Setup Installer (No Auto-Start)
# ---------------------------------------------------------------
# This script installs:
# ✔ Git
# ✔ Node.js + npm
# ✔ AtherixCloud Bot files from GitHub
# ✔ npm dependencies
# ✔ Creates .env template
# ---------------------------------------------------------------

echo "🚀 Starting AtherixCloud Bot Installer (No Start Mode)..."
sleep 1

# -----------------------------
# 📦 Update system
# -----------------------------
echo "📥 Updating system packages..."
sudo apt update -y && sudo apt upgrade -y

# -----------------------------
# 🛠 Install Git
# -----------------------------
echo "🔧 Installing Git..."
sudo apt install -y git

# -----------------------------
# 📗 Install Node.js & npm
# -----------------------------
echo "📗 Installing Node.js & npm..."
sudo apt install -y nodejs npm

# -----------------------------
# 📁 Clone AtherixCloud repo
# -----------------------------
echo "📡 Cloning AtherixCloud repository..."
git clone https://github.com/FluidNodesOffical/Atherixcloud-.git

cd Atherixcloud- || { echo "❌ Failed to enter project directory!"; exit 1; }

# -----------------------------
# 📦 Install dependencies
# -----------------------------
echo "📦 Installing npm dependencies..."
npm install

# -----------------------------
# ⚙️ Create .env
# -----------------------------
echo "📝 Creating .env file..."

cat <<EOF > .env
TOKEN=YOUR_BOT_TOKEN_HERE
CHANNEL_ID=YOUR_STATUS_CHANNEL
REFRESH_INTERVAL=5000
EOF

# -----------------------------
# 🎉 Done (No Start)
# -----------------------------
echo ""
echo "✨ AtherixCloud Installation Complete! (Bot Not Started) ✨"
echo "----------------------------------------------------------"
echo "📌 Location: $(pwd)"
echo ""
echo "💡 Next steps:"
echo "  1️⃣ Edit your .env file:"
echo "     nano .env"
echo ""
echo "  2️⃣ Start the bot manually when ready:"
echo "     node index.js"
echo ""
echo "🎯 Installer finished without starting the bot."
