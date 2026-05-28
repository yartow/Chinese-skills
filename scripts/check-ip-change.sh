#!/bin/bash
# Checks if your public IP has changed since last run.
# If it has, prints instructions on what to update.
# Run manually, or schedule with cron for automatic checks.

IP_FILE="$HOME/.last_public_ip"
CURRENT_IP=$(curl -s https://api.ipify.org)

if [ -z "$CURRENT_IP" ]; then
  echo "ERROR: Could not reach api.ipify.org — check your internet connection."
  exit 1
fi

if [ ! -f "$IP_FILE" ]; then
  echo "$CURRENT_IP" > "$IP_FILE"
  echo "First run. Public IP saved: $CURRENT_IP"
  exit 0
fi

LAST_IP=$(cat "$IP_FILE")

if [ "$CURRENT_IP" = "$LAST_IP" ]; then
  echo "IP unchanged: $CURRENT_IP"
else
  echo "========================================="
  echo "  PUBLIC IP HAS CHANGED"
  echo "  Old: $LAST_IP"
  echo "  New: $CURRENT_IP"
  echo "========================================="
  echo ""
  echo "Update the following:"
  echo ""
  echo "  1. cPanel Zone Editor"
  echo "     → Log into cPanel"
  echo "     → Zone Editor → andrew-yong.com"
  echo "     → Find the A record for 'learnchinese'"
  echo "     → Change the value to: $CURRENT_IP"
  echo ""
  echo "  That's it. Port forwarding rules don't need changing."
  echo ""
  echo "Saving new IP..."
  echo "$CURRENT_IP" > "$IP_FILE"
fi
