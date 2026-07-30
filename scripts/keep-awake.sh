#!/bin/bash
# Holds a systemd-inhibit lock for as long as this process runs, blocking
# idle suspend, explicit `systemctl suspend`, and shutdown. Intended to be
# run by keep-awake.service (systemd), not invoked directly.
#
# --mode=block means the lock actively prevents the action (not just delays
# it), so this also stops someone/something from suspending the box on
# purpose while it's meant to be serving Docker traffic.

exec systemd-inhibit \
  --what=idle:sleep:shutdown \
  --who="docker-keep-awake" \
  --why="Docker containers must keep running" \
  --mode=block \
  sleep infinity
