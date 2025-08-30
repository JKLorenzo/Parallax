#!/bin/bash

echo "Parallax Service Installation"
SVC=parallax.service

# Ensure the user has sudo privileges
sudo -v
if [ $? -ne 0 ]; then
  exit 1
fi

USR=$USER
GRP=$(id -gn)
CWD=$(pwd)

NODE=$(which node)
echo -e "\nChecking for existing Node.js..."
if [ -z $NODE ]; then
  echo "Error: No Node.js install detected"
  exit 1
fi
echo -e "Found $NODE"

echo -e "\nChecking for existing service..."
if [[ -n $(systemctl status $SVC | grep "Active: active") ]]; then
  echo "Stopping active service..."
  sudo systemctl stop $SVC
fi

echo -e "\nInstalling dependencies..."
npm ci

if [ $? -ne 0 ]; then
  echo "Failed to install dependencies."
  exit 1
fi

echo -e "\nBuilding..."
npm run rebuild

if [ $? -ne 0 ]; then
  echo "Error building."
  exit 1
fi

echo -e "\nCreating Parallax service..."
sudo bash -c "cat > /etc/systemd/system/$SVC << EOL
[Unit]
Description=Parallax
Wants=network-online.target
After=network-online.target

[Service]
User=${USR}
Group=${GRP}
WorkingDirectory=${CWD}
ExecStart=${NODE} build/main.js
Restart=always

[Install]
WantedBy=multi-user.target
EOL"

if [ $? -ne 0 ]; then
  echo "Failed to create service."
  exit 1
fi

echo -e "\nEnabling service to start on boot..."
sudo systemctl enable parallax.service
if [ $? -ne 0 ]; then
  echo "Failed to enable service."
  exit 1
fi

echo -e "\nStarting service..."
sudo systemctl start parallax.service
if [ $? -ne 0 ]; then
  echo "Failed to start service."
  exit 1
fi

echo -e "\nSuccess! Parallax service is now active."
