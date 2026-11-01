# AI receptionist backend

Retell answers the phone (the front desk). This code is the back office: it quotes prices,
checks Google Calendar, books the job, and texts JP through Twilio.

Edit `src/config/receptionist.ts` first: business name, hours, deposit, and every price and job time
are placeholders marked TODO.

## Endpoints (all POST, header `Authorization: Bearer <RECEPTIONIST_SECRET>`)

| URL | When the AI calls it | Args |
|---|---|---|
| `/api/receptionist/quote_price` | caller asks the price | `service`, `vehicle_size` (car/suv/truck) |
| `/api/receptionist/check_availability` | picking a time | `service`, `date` (YYYY-MM-DD) |
| `/api/receptionist/book_job` | garage or shade confirmed | service, vehicle_size, vehicle_description, location_type, address, start (ISO from check_availability), customer_name, customer_phone?, notes? |
| `/api/receptionist/text_jp` | dealer, complaint, custom, or no garage/shade | reason, message, customer_name?, customer_phone? |

In Retell, add each as a Custom Function with that URL, method POST, and the Authorization header.
The caller's number is filled in automatically if the AI doesn't collect one.

## Environment variables (Vercel project settings)

- `RECEPTIONIST_SECRET`: a long random string; paste the same value into Retell's headers.
- `GOOGLE_SERVICE_ACCOUNT_JSON`: whole JSON key of a Google service account. Share JP's calendar with its
  `client_email` ("Make changes to events").
- `GOOGLE_CALENDAR_ID`: usually JP's Gmail address.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (+1...).
- `JP_PHONE_NUMBER`: where JP's texts go, in +1... format.

## Test

`npm run receptionist:test` checks time math and quoting offline. Then run your 8 test calls against the live URL.
