# Voice Agent — Infrastructure & Services

## Current Setup (Development/Testing)

| Service | Provider | Plan | Monthly Cost | Status |
|---------|----------|------|-------------|--------|
| Frontend Hosting | Vercel | Free | ₹0 | ✅ Live |
| Backend Hosting | Render | Pro | ₹2,100 ($25) | ✅ Live |
| Real-time Media | LiveKit Cloud | Free | ₹0 | ✅ Live |
| Speech-to-Text (STT) | Deepgram (Nova-2) | Pay-as-you-go | ~₹0.36/min | ✅ Live |
| LLM (AI Brain) | OpenAI (GPT-4o-mini) | Pay-as-you-go | ~₹0.17/min | ✅ Live |
| Text-to-Speech (TTS) | Cartesia (Sonic) | Pay-as-you-go | ~₹2.95/min | ✅ Live |
| Voice Activity Detection | Silero (self-hosted) | Free | ₹0 | ✅ Live |
| SIP/Telephony | Vobiz | Pay-as-you-go | ~₹1.00/min | ✅ Live |
| Database | Supabase | Free | ₹0 | ✅ Live |
| Storage (Recordings) | Supabase Storage | Free (1GB) | ₹0 | ✅ Live |
| Authentication | Supabase Auth | Free | ₹0 | ✅ Live |
| Payments | Razorpay | Per-transaction (2%) | ₹0 fixed | ✅ Live |
| Notifications | WhatsApp API | Pay-per-message | ~₹0.50/msg | ✅ Live |

### Current Monthly Fixed Cost: ₹2,100/mo
### Current Variable Cost: ~₹4.5/min per call

---

## What Needs to be Upgraded for Production (Customer-Facing)

### MUST UPGRADE (Required for production)

| Service | Current | Upgrade To | Why | New Cost |
|---------|---------|-----------|-----|----------|
| **Vercel** | Free | Pro ($20/mo) | Free tier has 100GB bandwidth limit, no team features, slower builds | ₹1,680/mo |
| **LiveKit Cloud** | Free | Startup ($50/mo) | Free tier limited to 100 participants/day, no SLA, may throttle | ₹4,200/mo |
| **Supabase** | Free | Pro ($25/mo) | Free tier: 500MB DB, 1GB storage, 50K auth users, no backups, pauses after 1 week inactivity | ₹2,100/mo |

### RECOMMENDED UPGRADES (For reliability at scale)

| Service | Current | Upgrade To | Why | New Cost |
|---------|---------|-----------|-----|----------|
| **Render** | Pro ($25) | Pro+ ($85/mo) | More CPU/RAM for concurrent calls, auto-scaling | ₹7,140/mo |
| **Deepgram** | Pay-as-you-go | Growth Plan | Volume discount (~15% cheaper), priority support | Same (usage-based) |
| **Cartesia** | Pay-as-you-go | Growth ($21/mo) | 2.5M chars/mo included, cheaper per-char after | ₹1,764/mo |

### NO UPGRADE NEEDED

| Service | Why |
|---------|-----|
| OpenAI GPT-4o-mini | Pay-as-you-go scales fine, no minimum |
| Silero VAD | Self-hosted, free forever |
| Vobiz SIP | Pay-as-you-go, no plan needed |
| Razorpay | Transaction-based, no fixed fee |
| WhatsApp API | Message-based, no plan upgrade needed |

---

## Production Budget Summary

### Minimum Production Setup

| Item | Monthly Cost (₹) |
|------|-----------------|
| Vercel Pro | 1,680 |
| Render Pro | 2,100 |
| LiveKit Cloud Startup | 4,200 |
| Supabase Pro | 2,100 |
| **Fixed Total** | **₹10,080/mo** |
| Variable (per call, 2.5 min avg) | ~₹17.50/call |

### Recommended Production Setup (for 1000+ calls/mo)

| Item | Monthly Cost (₹) |
|------|-----------------|
| Vercel Pro | 1,680 |
| Render Pro+ | 7,140 |
| LiveKit Cloud Startup | 4,200 |
| Supabase Pro | 2,100 |
| Cartesia Growth | 1,764 |
| **Fixed Total** | **₹16,884/mo** |
| Variable (per call, 2.5 min avg) | ~₹15/call (with Cartesia plan discount) |

---

## Free Tier Limits (Why You Must Upgrade)

| Service | Free Tier Limit | What Happens When Exceeded |
|---------|----------------|---------------------------|
| Vercel | 100GB bandwidth, 6000 build mins | Site goes down |
| LiveKit Cloud | ~100 participant-minutes/day | Calls fail to connect |
| Supabase DB | 500MB, 2 projects | DB stops accepting writes |
| Supabase Storage | 1GB | Recordings stop saving |
| Supabase Auth | 50K MAU | Logins fail |
| Supabase | 1 week inactivity | Project auto-pauses |

---

## Environment Variables Needed for Production

### Already Configured
```
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
OPENAI_API_KEY
DEEPGRAM_API_KEY
CARTESIA_API_KEY
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_KEY
VOBIZ_SIP_TRUNK_ID
VOBIZ_SIP_DOMAIN
VOBIZ_USERNAME
VOBIZ_PASSWORD
VOBIZ_OUTBOUND_NUMBER
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
```

### Recently Added (for Recordings)
```
SUPABASE_S3_ACCESS_KEY
SUPABASE_S3_SECRET_KEY
SUPABASE_S3_ENDPOINT
```

---

## Action Items Before Go-Live

- [ ] Upgrade Supabase to Pro plan
- [ ] Upgrade Vercel to Pro plan
- [ ] Upgrade LiveKit Cloud to Startup plan
- [ ] Verify all env variables are set on Vercel
- [ ] Test recording download after S3 setup
- [ ] Set up Supabase database backups (comes with Pro)
- [ ] Configure custom domain on Vercel
- [ ] Set up monitoring/alerts for call failures
- [ ] Load test with 10+ concurrent calls
