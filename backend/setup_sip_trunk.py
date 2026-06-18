"""
Create the SIP trunk on the local LiveKit server.
Run once after `docker compose up` to register the Vobiz SIP trunk.

Usage:
  docker compose exec voice-agent python setup_sip_trunk.py
"""

import asyncio
import os

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
    lk = api.LiveKitAPI(
        url=LIVEKIT_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET,
    )

    try:
        # Create outbound SIP trunk for dialing via Vobiz
        trunk = await lk.sip.create_sip_outbound_trunk(
            api.CreateSIPOutboundTrunkRequest(
                trunk=api.SIPOutboundTrunkInfo(
                    name="vobiz-outbound",
                    address=SIP_DOMAIN,
                    numbers=[SIP_OUTBOUND_NUMBER],
                    auth_username=SIP_USERNAME,
                    auth_password=SIP_PASSWORD,
                )
            )
        )
        print(f"✅ Outbound SIP trunk created!")
        print(f"   Trunk ID: {trunk.sip_trunk_id}")
        print(f"   Address:  {SIP_DOMAIN}")
        print(f"   Number:   {SIP_OUTBOUND_NUMBER}")
        print(f"\n👉 Update your .env with:")
        print(f"   VOBIZ_SIP_TRUNK_ID={trunk.sip_trunk_id}")

    except Exception as e:
        print(f"❌ Error creating trunk: {e}")
    finally:
        await lk.aclose()


if __name__ == "__main__":
    asyncio.run(main())
