# Connecting Retell

Site URL below is `https://aiassist-cyan.vercel.app`. Replace it if you add a custom domain.
`<SECRET>` is the same value as `RECEPTIONIST_SECRET` in Vercel.

## 1. Add four custom functions (Agent -> Functions -> Add -> Custom Function)

For every function: Method **POST**, header `Authorization: Bearer <SECRET>`, timeout 20s,
leave "payload: args only" **off** (so the caller's phone number comes through).

| Name | URL |
|---|---|
| `quote_price` | `https://aiassist-cyan.vercel.app/api/receptionist/quote_price` |
| `check_availability` | `https://aiassist-cyan.vercel.app/api/receptionist/check_availability` |
| `book_job` | `https://aiassist-cyan.vercel.app/api/receptionist/book_job` |
| `text_jp` | `https://aiassist-cyan.vercel.app/api/receptionist/text_jp` |

Parameters (JSON schema) for each:

```json
// quote_price
{"type":"object","properties":{"service":{"type":"string","enum":["interior","exterior","full_detail","clay_bar","maintenance","stage1","stage2","stage3","ceramic"]},"vehicle_size":{"type":"string","enum":["car","suv","truck"]}},"required":["service"]}

// check_availability  (pass the caller's own words; the server works out the date)
{"type":"object","properties":{"service":{"type":"string","enum":["interior","exterior","full_detail","clay_bar","maintenance","stage1","stage2","stage3","ceramic"]},"date":{"type":"string","description":"The day exactly as the caller said it, like 'tuesday the 5th', 'tomorrow' or 'november 12'. Do not reformat it."},"preferred_time":{"type":"string","description":"The time the caller asked for, as they said it, like '10:30', '1030' or '1pm'. Leave out if they have no preference."}},"required":["service","date"]}

// book_job  (use the exact "start" value returned by check_availability)
{"type":"object","properties":{"service":{"type":"string","enum":["interior","exterior","full_detail","clay_bar","maintenance","stage1","stage2","stage3","ceramic"]},"vehicle_description":{"type":"string"},"location_type":{"type":"string","enum":["garage","shade"]},"address":{"type":"string"},"start":{"type":"string","description":"ISO time from check_availability"},"customer_name":{"type":"string"},"customer_phone":{"type":"string","description":"+1XXXXXXXXXX, only if the caller gives a different number"},"notes":{"type":"string"}},"required":["service","vehicle_description","location_type","address","start","customer_name"]}

// text_jp
{"type":"object","properties":{"reason":{"type":"string","enum":["dealer","complaint","custom","other_info","no_garage_or_shade"]},"message":{"type":"string"},"customer_name":{"type":"string"},"customer_phone":{"type":"string"}},"required":["reason","message"]}
```

Service names must match `SERVICES` in `src/config/receptionist.ts`. Prices are flat, so no vehicle size is needed.

## 2. Tell the agent today's date

In the prompt, include `Current time: {{current_time_America/New_York}}` so "tomorrow" and "Friday" resolve correctly.
Also tell it: call `check_availability` before offering times, and only book times that function returned.

## 3. Send call records to the dashboard

Agent settings -> **Webhook URL**:
`https://aiassist-cyan.vercel.app/api/retell/webhook?token=<SECRET>`
Enable the `call_ended` and `call_analyzed` events.

## 4. Test

Run a web call from Retell first, then the eight test calls. After each, check Calls, Jobs and the Google Calendar.

## 5. Stripe deposits (optional until you add keys)

Without Stripe keys the app still books jobs and tells JP the deposit link wasn't created.
1. In Stripe, use **test mode** first. Developers -> API keys -> copy the *secret* key into Vercel as `STRIPE_SECRET_KEY`.
2. Developers -> Webhooks -> Add endpoint: `https://aiassist-cyan.vercel.app/api/stripe/webhook`, event `checkout.session.completed`.
   Copy its *signing secret* into Vercel as `STRIPE_WEBHOOK_SECRET`.
3. Redeploy. Pay a test booking with card `4242 4242 4242 4242`; the Jobs page should flip Due -> Paid.
4. When happy, swap in the live keys and a live-mode webhook.
