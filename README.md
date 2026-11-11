# Abar Khabo - Delivery Partner Portal (React + Vite + Firebase)

Features: delivery-partner registration, Indian mobile numbers only, identity verification with any one ID (+ driving licence for motorbike riders), Cloudinary image storage, admin panel with full biodata, login, location-based accept portal, my deliveries, admin approval, and POS integration.

## Step 1 - Run it locally
```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run dev
```

## Step 1b - Cloudinary (PRIVATE images)
All photos (selfie, ID, licence) are stored on Cloudinary as **authenticated** assets: they have no public link. Uploads are signed by the server, and photos can be opened only through `/api/photo`, which allows the admin or the rider who owns the photo and nobody else. Firestore stores only the photo id.
1. https://cloudinary.com -> Dashboard -> copy **Cloud name**, **API key**, **API secret** into the server variables (`CLOUDINARY_*`, see `.env.example`).
2. No upload preset is needed any more. If you created an unsigned preset earlier, delete it (Settings -> Upload -> Upload presets).
3. Photos uploaded with the old version are public links. Re-upload them or delete them in Cloudinary if they matter.

## Step 1c - WhatsApp (photos to the admin's phone)
Uses the free-to-start **Meta WhatsApp Business Cloud API**.
1. https://developers.facebook.com -> create an app (Business) -> add **WhatsApp**. Copy the **Phone number ID** and create a permanent **System User token** -> `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN`.
2. WhatsApp only allows a business to send free-form messages within 24 hours after the person last messaged it. So the admin should send "hi" to the business number now and then, **or** create a message template (Category: Utility) with an **Image header** and a body of just `{{1}}`, get it approved, and put its name in `WHATSAPP_TEMPLATE_NAME`. With the template, photos arrive even outside the 24-hour window.
3. In the app: Admin panel -> **WhatsApp** tab -> enter the number -> your admin password -> Save -> "Send a test message". Changing the number later works the same way; the server reads the saved number on every send, so new photos go to the new number straight away.

## Server setup (needed for private photos + WhatsApp)
The `api/` folder holds Vercel serverless functions. Add every variable from the "Server only" part of `.env.example` in Vercel -> Settings -> Environment Variables. For local testing use `npx vercel dev` instead of `npm run dev` (plain `npm run dev` has no `/api`). Run `npm install` once so `package-lock.json` picks up `firebase-admin` and `cloudinary`.

## Step 2 - Create the Firebase project
1. https://console.firebase.google.com -> Add project (or reuse your POS project).
2. Build -> Authentication -> Get started -> enable **Email/Password**.
3. Build -> Firestore Database -> Create database (production mode).
4. Project settings -> Your apps -> Web app (</>) -> copy the config values into `.env`:
   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID
5. Restart `npm run dev`.

## Step 3 - Security rules
Firestore -> Rules -> paste the full contents of `firestore.rules` -> Publish. (It now includes `settings/`, readable and writable by admins only.)

## Step 4 - Create the admin account (Firebase console)
Admin is never created from the app (that would be a security hole). Do it once by hand:
1. Firebase console -> Authentication -> Users -> **Add user** -> enter the admin email + password.
2. Copy that user's **User UID**.
3. Firestore -> Start collection `admins` -> Document ID = that UID -> add any field (e.g. `role: "admin"`).
4. Open the app -> /login -> log in with that email. You land on **/admin** automatically.

## Step 5 - Test the full flow
1. Admin -> Riders -> **Approve** your rider.
2. Admin -> Test order -> tap "Use my location as pickup" -> Create order.
3. Orders -> **Go online** (allow location) -> the order appears -> **Accept**.
4. My deliveries -> Mark as picked up -> Mark as delivered.
Tip: test the rider on a second browser/profile, or phone, with a second account.

## Step 6 - Connect the POS
Open `pos-integration/pushDeliveryOrder.js` and copy it into your POS project. It explains the two cases (same Firebase project, or a different one).
Note: the rules let any signed-in account that is not a rider create orders. Your POS staff accounts qualify when the POS uses the same project.

## Step 7 - Deploy (Vercel)
Push to GitHub, import in Vercel, add the 4 `VITE_FIREBASE_*` variables and the server variables, deploy.
Then Firebase -> Authentication -> Settings -> Authorized domains -> add your Vercel domain.
Location works only on HTTPS (Vercel is HTTPS).

## How the delivery-partner flow works
1. Registers (Indian mobile only) -> gets a verification email -> is sent to the login page. Login is blocked until the email is verified. "Forgot password?" is on the login page.
2. After the first verified login the partner sees the verification tasks: **Identity** (any ONE of Aadhaar / Voter ID / PAN / Passport / Driving Licence, number + photos) and, **only for motorbike riders, a Driving licence**. Bicycle and on-foot partners need identity only.
3. Admin panel -> Riders -> **Needs action** -> View details -> checks biodata + photos -> **Mark verified** or **Reject** (with a reason the partner sees).
4. When the needed documents are verified, **Approve** becomes active. Approving creates the ID (AK-0001, AK-0002 ...).
5. Verified partners get a **Verified** badge next to their name and photo. Approved partners see deliveries done, total earned, today's numbers and their average rating.
6. Ratings come from the POS: see `pos-integration/pushDeliveryRating.js` (needs a `staff/<uid>` document for the POS account).
7. Partners change their own password on their Home page. Admin can send a reset email to any partner.

## Notes
- Aadhaar numbers: only the last 4 digits are stored as text (checksum-validated in the form). Documents are in `riders/{uid}/kyc/{identity|license}`; photos live on Cloudinary.
- Riders who have not verified their email are hidden from the admin list.
- Re-publish `firestore.rules` after every update.
- Photos are compressed in the browser before upload to Cloudinary.
- When a rider submits ID photos, the server sends the selfie + ID photos + details to the admin's WhatsApp. If it fails, the rider's document card in the admin panel shows why and has a **Send to WhatsApp again** button.
- Not covered: rate limiting on uploads (a signed-in account can upload photos into its own folder). Add Vercel's firewall rate limit on `/api/sign-upload` if abuse appears.
- Orders have optional `pickupLat`/`pickupLng`; with them, riders only see orders within 8 km (change MAX_KM in `src/pages/Accept.jsx`).
- Accepting uses a Firestore transaction, so two riders can never take the same order.

## Ideas for next steps
Customer tracking page from rider lat/lng, rider earnings by day, push notifications (needs Cloud Functions / Blaze plan), map view (Leaflet + OpenStreetMap is free).
