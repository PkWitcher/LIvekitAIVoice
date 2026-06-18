#!/bin/bash
# Create SIP trunk on startup, then start the voice agent
python setup_sip_trunk.py

# Export the trunk ID if it was created
if [ -f /tmp/sip_trunk_id ]; then
  export VOBIZ_SIP_TRUNK_ID=$(cat /tmp/sip_trunk_id)
  echo "Using SIP trunk: $VOBIZ_SIP_TRUNK_ID"
fi

exec python agent.py start
