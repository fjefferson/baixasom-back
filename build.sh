#!/usr/bin/env bash
# Install system dependencies
apt-get update
apt-get install -y python3 python3-pip ffmpeg
pip3 install -U yt-dlp

# Install Node dependencies
yarn install
