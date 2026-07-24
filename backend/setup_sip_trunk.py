"""
Create the SIP trunk on the local LiveKit server.
Runs automatically on container startup via start.sh.
Also writes VOBIZ_SIP_TRUNK_ID so the agent picks it up.
"""

import asyncio
import os
import time

from dotenv import load_dotenv
from livekit import api

load_dotenv()

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "http://livekit:7880")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "devkey")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "secret")

SIP_DOMAIN = os.getenv("VOBIZ_SIP_DOMAIN", "")
SIP_USERNAME = os.getenv("VOBIZ_USERNAME", "")
SIP_PASSWORD = os.getenv("VOBIZ_PASSWORD", "")
SIP_OUTBOUND_NUMBER = os.getenv("VOBIZ_OUTBOUND_NUMBER", "")


async def main():
    # Wait for livekit to be ready
    for attempt in range(10):
        try:
            lk = api.LiveKitAPI(
                url=LIVEKIT_URL,
                api_key=LIVEKIT_API_KEY,
                api_secret=LIVEKIT_API_SECRET,
            )
            # Try listing trunks to check if already exists
            trunks = await lk.sip.list_sip_outbound_trunk(
                api.ListSIPOutboundTrunkRequest()
            )
            # If a trunk already exists, reuse it (don't delete on restart!)
            if trunks.items:
                trunk_id = trunks.items[0].sip_trunk_id
                print(f"✅ Reusing existing SIP trunk: {trunk_id}")
                with open("/tmp/sip_trunk_id", "w") as f:
                    f.write(trunk_id)
                await lk.aclose()
                return

            # Create outbound SIP trunk with TCP transport
            trunk = await lk.sip.create_sip_outbound_trunk(
                api.CreateSIPOutboundTrunkRequest(
                    trunk=api.SIPOutboundTrunkInfo(
                        name="vobiz-outbound",
                        address=SIP_DOMAIN,
                        numbers=[SIP_OUTBOUND_NUMBER],
                        auth_username=SIP_USERNAME,
                        auth_password=SIP_PASSWORD,
                        transport=api.SIPTransport.SIP_TRANSPORT_TCP,
                    )
                )
            )
            trunk_id = trunk.sip_trunk_id
            print(f"✅ Outbound SIP trunk created (TCP): {trunk_id}")
            with open("/tmp/sip_trunk_id", "w") as f:
                f.write(trunk_id)
            await lk.aclose()
            return

        except Exception as e:
            print(f"⏳ Waiting for LiveKit ({attempt+1}/10): {e}")
            try:
                await lk.aclose()
            except:
                pass
            time.sleep(3)

    print("❌ Could not create SIP trunk after 10 attempts")


if __name__ == "__main__":
    asyncio.run(main())
