#!/bin/bash
# Double-clickable launcher for the Endurance dashboard.
export PATH="$HOME/tools/node/bin:$PATH"
cd "$(dirname "$0")"
(sleep 3 && open "http://localhost:3100") &
exec npx next dev -p 3100
