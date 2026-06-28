#!/bin/bash
# Start the voice agent
# Note: SIP trunk setup is skipped — using pre-registered trunk from VOBIZ_SIP_TRUNK_ID env var
# Uncomment the next line only if you need to create a NEW trunk on Vobiz:
# python setup_sip_trunk.py && export VOBIZ_SIP_TRUNK_ID=$(cat /tmp/sip_trunk_id)

echo "Using SIP trunk: $VOBIZ_SIP_TRUNK_ID"
exec python agent.py start
