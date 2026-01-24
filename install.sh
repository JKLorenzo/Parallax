#!/bin/bash

printf "Parallax Service Installation\n"
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
printf "\nChecking for existing Node.js...\n"
if [ -z $NODE ]; then
  printf "Error: No Node.js install detected\n"
  exit 1
fi
printf "Found %s\n" $NODE

printf "\nChecking for existing service...\n"
if [[ -n $(systemctl status $SVC | grep "Active: active") ]]; then
  printf "Stopping active service...\n"
  sudo systemctl stop $SVC
fi

printf "\nInstalling dependencies...\n"
npm install

if [ $? -ne 0 ]; then
  printf "Failed to install dependencies.\n"
  exit 1
fi

printf "\nBuilding...\n"
npm run rebuild

if [ $? -ne 0 ]; then
  printf "Error building.\n"
  exit 1
fi

printf "\nCreating Parallax service...\n"
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
  printf "Failed to create service.\n"
  exit 1
fi

printf "\nEnabling service to start on boot...\n"
sudo systemctl enable parallax.service
if [ $? -ne 0 ]; then
  printf "Failed to enable service.\n"
  exit 1
fi

printf "\nStarting service...\n"
sudo systemctl start parallax.service
if [ $? -ne 0 ]; then
  printf "Failed to start service.\n"
  exit 1
fi

printf "\nSuccess! Parallax service is now active.\n"
