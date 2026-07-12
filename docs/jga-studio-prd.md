# JGA Studio App PRD

Version: 0.1 draft  
Date: 2026-07-12  
Prepared from local app inspection of `/Users/jaygolding/jga-studio`

## 1. Product Summary

JGA Studio is a collector-facing mobile app for discovering, saving, buying, bidding on, and being rewarded for Jay Golding artwork. The current app is already more than a portfolio: it combines artwork browsing, Stripe checkout, collector profiles, Privy login, embedded wallets on Base, token balances, reward claims, QR-based sending/receiving, and an auction surface that is ready for deeper bidding functionality.

The next product step is to turn this from a promising local build into a dependable studio commerce and collector relationship platform.

## 2. Product Vision

Create a direct collector channel for JGA Studio where collectors can:

- Discover available works and understand the story, medium, price, and status of each piece.
- Purchase artwork through a polished mobile checkout.
- Save works, follow releases, and receive timely reminders.
- Build a collector identity connected to purchases, rewards, and wallet activity.
- Participate in future auctions and collector-only opportunities.

For the studio, the app should become a lightweight operating system for releases, inventory, sales, collectors, auctions, and rewards.

## 3. Current App Snapshot

### Platform

- Expo / React Native app with Expo Router.
- Native iOS/Android target with limited web support.
- Main navigation tabs: Home, Discover, Auctions, Profile.
- Artwork detail route at `/artwork/[id]`.
- Supabase backend integration.
- Stripe mobile checkout integration.
- Privy login and embedded wallet integration.
- Base chain wallet/reward functionality.

### Key Screens Already Present

- Home marketplace with search, featured work, new works, price filters, category browsing, and auctions ending soon.
- Discover screen with category filters, artwork grid, featured highlight, and artist biography.
- Auctions screen with live/upcoming auction lists, auction statistics, and future collector tools.
- Artwork detail screen with image viewing, metadata, wishlist, share, shipping estimate, Stripe checkout, and auction CTA placeholder.
- Profile screen with email login, wallet creation/sync, balances, send/receive flow, QR scanning, reward claims, wishlist/collection sections, and settings.
- Notifications screen with mock notification examples and planned notification categories.

### Data Entities In Use

Observed from app code:

- `art_pieces`
- `auction_lots`
- `collector_wallets`
- `reward_events`
- `beta_users`

Likely missing or not yet visible:

- Orders / purchases
- Payment events
- Shipment records
- Bid records
- Notification preferences
- Collector profiles
- Admin inventory actions
- Audit logs

## 4. Primary Users

### Collector

Someone interested in browsing, saving, buying, bidding on, or following Jay Golding artwork. This user may be crypto-native or may only want a simple card checkout experience.

### Studio Admin

Jay or a trusted studio operator managing artwork inventory, releases, sales, collector communication, reward events, and auction setup.

### Returning Patron

A collector who has purchased before and wants purchase history, rewards, early access, saved works, and future release notifications.

### Auction Participant

A collector who wants to watch lots, bid, receive reminders, and settle purchases after winning.

## 5. Product Goals

- Make the app trustworthy enough for real art purchases.
- Support a clean collector journey from discovery to purchase confirmation.
- Give collectors a reason to return through saved works, notifications, rewards, and auctions.
- Give the studio clear operational control over inventory, orders, collectors, and releases.
- Keep wallet and token features useful without making them mandatory for non-crypto collectors.

## 6. Non-Goals For The Near Term

- Full public social network features.
- Marketplace support for artists beyond JGA Studio.
- Complex DeFi or speculative token mechanics.
- Fully decentralized commerce.
- Replacing accounting, tax, or shipping software entirely.

## 7. Core User Journeys

### Browse And Buy Artwork

1. Collector opens app.
2. Collector browses featured, new, filtered, or categorized works.
3. Collector opens an artwork detail page.
4. Collector reviews images, story, price, dimensions, condition, signature, and shipping estimate.
5. Collector checks out with Stripe.
6. App confirms purchase and updates artwork availability.
7. Collector sees purchase in profile.
8. Studio receives the order and fulfillment details.

### Save Work For Later

1. Collector views an artwork.
2. Collector taps wishlist.
3. Artwork appears in profile.
4. Collector can return to saved works later.
5. Future version: collector receives reminders when saved work changes status, price, auction timing, or availability.

### Create Collector Identity

1. Collector signs in with email through Privy.
2. App creates or connects a collector profile.
3. Collector can create an embedded wallet.
4. Wallet address syncs to Supabase.
5. Profile shows saved works, purchases, rewards, and wallet balances.

### Participate In Auction

1. Collector browses live or upcoming auction lots.
2. Collector opens the lot detail.
3. Collector watches the lot or places a bid.
4. App validates bid amount, identity, eligibility, and timing.
5. Collector receives outbid and ending-soon reminders.
6. Winning collector receives invoice or checkout flow.
7. Lot is settled and moved into purchase history.

### Claim Rewards

1. Collector makes an eligible purchase or completes another rewardable action.
2. Reward event is created.
3. Collector sees claimable rewards in profile.
4. Collector claims rewards to connected wallet.
5. App records claim status and transaction hash.

## 8. Existing MVP Capabilities

### Catalog And Discovery

- Artwork listings from Supabase.
- Search by title, medium, and description.
- Price range filtering.
- Category browsing by medium.
- Featured release section.
- Artist biography and studio story content.

### Artwork Detail

- Large artwork image.
- Image zoom/viewer on native.
- Price display.
- Artwork metadata.
- Description.
- Wishlist save/remove.
- Native share sheet.
- Estimated domestic shipping note.
- Stripe PaymentSheet purchase flow on native.
- Auction countdown and placeholder bid CTA for auction works.

### Auctions

- Live and upcoming auction lots.
- Auction stats.
- Lot cards with countdown, estimates, current bid, and bid count.
- Future tools preview for watchlists, My Bids, and alerts.

### Collector Profile

- Privy email login.
- Embedded wallet creation.
- Wallet sync to Supabase.
- ETH, USDC, JGA Studio token, and ZORA balance display on Base.
- Send and receive flows.
- QR code display and scanner.
- Wishlist view.
- Reward summary and claim flow.
- Dark mode toggle.

## 9. Required Next-Level Capabilities

### P0 - Stabilize Real Commerce

The app should not accept real purchases until the order and inventory lifecycle is complete.

Requirements:

- Create an `orders` or `purchases` table.
- Create a server-side purchase confirmation path using Stripe webhooks.
- Mark artwork as reserved, sold, or available based on payment state.
- Prevent double purchases of the same artwork.
- Store buyer identity, payment status, artwork id, amount, currency, and fulfillment status.
- Add purchase history to profile.
- Add admin order visibility.
- Add receipt and confirmation messaging.
- Define refund, failed payment, and canceled payment behavior.

Acceptance criteria:

- A collector can purchase one available artwork.
- Payment success creates a durable order record.
- The purchased artwork is no longer purchasable by another collector.
- The collector can see the purchase in profile.
- The studio can see the order and fulfillment details.

### P0 - Fix Identity And Backend Trust Boundary

The app currently uses Privy identity and Supabase data, but the full trust relationship should be clarified and hardened.

Requirements:

- Decide whether Supabase Auth, Privy auth, or a custom server verification layer is the source of truth.
- Ensure all Supabase writes are protected by RLS or Edge Functions.
- Fix reward claiming if Supabase auth is required but the app only has a Privy session.
- Store collector profile data consistently.
- Remove hardcoded public/service-sensitive values from source where appropriate.
- Define admin authorization beyond a hardcoded email.

Acceptance criteria:

- A signed-in collector can only access and modify their own records.
- Reward claims cannot be spoofed by another user.
- Admin actions are protected by role-based access.

### P0 - Define Product Data Model

The artwork model should support real-world art sales and future auction logic.

Artwork fields to confirm:

- Title
- Description
- Images
- Medium
- Dimensions
- Year
- Condition
- Signed status
- Framing status
- Price
- Currency
- Availability status
- Collection / series
- Edition details, if applicable
- Provenance or exhibition notes
- Shipping profile
- Tax category
- Tags
- Featured/new flags

Auction fields to confirm:

- Lot id
- Artwork id
- Start time
- End time
- Status
- Opening bid
- Current bid
- Estimate low/high
- Reserve price
- Minimum increment
- Bid count
- Watch count
- Winning bidder
- Settlement status

### P1 - Build Studio Admin Workflows

The product needs a way for the studio to manage the app without editing database rows manually.

Requirements:

- Add artwork creation/editing.
- Upload and reorder images.
- Set availability, price, category, collection, and featured status.
- Create auction lots from artworks.
- View orders and fulfillment status.
- View collectors and purchase history.
- Trigger or schedule notifications.
- Create reward events manually or from purchase events.

Possible implementation paths:

- In-app hidden admin section.
- Separate web admin portal.
- Supabase Studio plus lightweight custom admin screens.

### P1 - Make Notifications Real

The current notifications screen is a strong product hint, but it is mock data.

Requirements:

- Store notification preferences.
- Support in-app notifications.
- Decide whether push notifications, email, or both are needed.
- Trigger notifications for new releases, auction reminders, wishlist changes, purchase updates, and reward status.
- Let users opt in/out by category.

### P1 - Complete Auction System

The auction surface is ready, but bidding is not implemented.

Requirements:

- Add bid creation and validation.
- Add auction lot detail page.
- Fix auction navigation so tapping a lot opens the correct artwork/lot context.
- Define bid increments, reserve behavior, and anti-sniping rules.
- Add watchlist.
- Add outbid and ending-soon reminders.
- Add settlement flow for winning bidders.
- Add admin lot management.

Acceptance criteria:

- A signed-in collector can place a valid bid.
- The app rejects invalid, late, or too-low bids.
- Current bid and bid count update correctly.
- Winning bidder can complete checkout.

### P1 - Clarify Rewards And Token Utility

The app already includes meaningful reward infrastructure, but the product rules need definition.

Questions to resolve:

- What does JGA Studio token represent?
- Is it loyalty, access, discounts, community status, or collectible utility?
- Are rewards tied only to purchases or also to bids, attendance, referrals, and drops?
- Are rewards claimable immediately or after fulfillment?
- Are there legal or financial disclaimers needed?
- Should fiat-only collectors see token features by default?

Requirements:

- Define reward formula and eligible actions.
- Generate reward events automatically from purchase events.
- Show reward history clearly.
- Store transaction hashes after claims.
- Add failed claim handling and retry.
- Add treasury balance monitoring.

### P2 - Improve Web Support

The web version currently appears browse-oriented, with checkout unavailable.

Decision needed:

- Is web a public browsing site only?
- Should web support checkout?
- Should web be used as the studio admin surface?
- Should web route users to mobile for wallet actions?

### P2 - Collector Relationship Management

Requirements:

- Saved artworks.
- Purchase history.
- Auction history.
- Reward history.
- Notification preferences.
- Shipping/contact details.
- Collector notes for admin.
- Collector status tiers, if desired.

## 10. Risks And Gaps Found In Current Build

- Payment success currently appears to create a PaymentIntent, but no complete order/inventory update flow is visible.
- Stripe webhook handling is not visible in the inspected files.
- Artwork could potentially remain available after payment unless handled elsewhere.
- Supabase URL and anon key appear hardcoded in `supabaseClient.ts`.
- Admin authorization currently appears tied to a hardcoded email in profile.
- Reward claiming may expect Supabase auth while the app login flow is Privy-based.
- Auction bidding is not implemented yet.
- Auction card navigation may be using the lot id where the artwork id is expected.
- Notifications are mock examples, not live data.
- `BetaGate.tsx` appears to be a duplicate of a themed view component rather than a working beta gate.
- `create-checkout-session` appears to contain placeholder success/cancel URLs and may be unused.
- Privy configuration appears duplicated between root layout and `privyConfig.ts`.
- Web checkout is intentionally unavailable.
- No schema/migration files were visible in the inspected set.

## 11. Success Metrics

### Collector Engagement

- App opens per collector.
- Artwork detail views.
- Search and filter usage.
- Wishlist saves.
- Notification opt-ins.
- Return visits after release announcements.

### Commerce

- Artwork detail to checkout conversion.
- Checkout success rate.
- Payment failure rate.
- Time from release to sale.
- Repeat collector rate.
- Average order value.

### Auctions

- Lot views.
- Watchlist saves.
- Registered bidders.
- Bids per lot.
- Outbid notification engagement.
- Settlement completion rate.

### Rewards

- Eligible reward events.
- Claim rate.
- Failed claim rate.
- Reward-driven repeat visits.

## 12. Recommended Roadmap

### Phase 0 - Product Alignment And Data Model

- Confirm user personas and launch audience.
- Finalize inventory, order, bid, collector, notification, and reward schemas.
- Decide Privy/Supabase auth architecture.
- Define what wallet/token features mean for non-crypto collectors.

### Phase 1 - Collector Commerce MVP

- Complete purchase lifecycle.
- Add order records and inventory locking.
- Add purchase history.
- Add studio order visibility.
- Harden security and environment configuration.
- Keep auction bidding disabled until the commerce core is safe.

### Phase 2 - Studio Operations

- Build admin artwork management.
- Build order management.
- Add collector profile management.
- Add notification preferences and basic in-app notifications.

### Phase 3 - Auctions

- Add bid model and bid flow.
- Add watchlists and reminders.
- Add settlement.
- Add admin auction tools.

### Phase 4 - Rewards And Collector Club

- Connect purchase events to rewards.
- Clarify token utility and disclaimers.
- Add reward history and transaction tracking.
- Consider collector tiers, early access, and private release features.

### Phase 5 - Public Launch Polish

- App Store/TestFlight readiness.
- Web role decision.
- Brand polish.
- Legal/privacy/support flows.
- Analytics dashboard.

## 13. Key Questions For Jay

1. What is the first real launch target: private TestFlight beta, App Store release, web preview, or internal studio tool?
2. Should the app feel more like a luxury gallery marketplace, an experimental artist studio, a collector club, or a crypto-native collecting experience?
3. Is the primary goal short-term sales, collector relationship management, auction experiments, token/reward utility, or all of these in phases?
4. Should wallet creation be optional for collectors who only want to buy with a card?
5. What should happen after a collector buys a work: immediate sold status, reserved until fulfillment review, or manual studio approval?
6. Do you need shipping, tax, and fulfillment built into the app, or should the app only collect payment and notify you?
7. Are auctions intended to be real timed auctions with binding bids, or more like inquiry/interest-gathering events at first?
8. Should JGA Studio token rewards have monetary utility, access utility, discount utility, collector status utility, or symbolic/community utility?
9. Do you want an in-app admin panel, a separate web admin, or a lightweight backend workflow using Supabase first?
10. What artwork data source should be considered the source of truth: Supabase, a spreadsheet, Airtable/Notion, another inventory system, or manual in-app entry?
11. What notification channels matter most: in-app, push, email, or SMS?
12. Should web checkout be supported, or should the web version remain browse-only for now?
13. Is `jgastudio2@gmail.com` the long-term admin account, or just a temporary development shortcut?
14. Should rewards be created automatically after payment, only after fulfillment, or manually by the studio?
15. What does "next level" mean for the next milestone: stable real sales, a polished collector app, auction functionality, admin tooling, or launch readiness?

## 14. Suggested Immediate Build Priorities

1. Add a real order/purchase lifecycle.
2. Lock artwork availability during checkout and mark sold after payment confirmation.
3. Add purchase history to profile.
4. Fix Privy/Supabase identity integration.
5. Replace mock/stub admin and notification flows with real data-backed flows.
6. Decide whether auctions and rewards ship in MVP or remain beta/future features.
7. Create a studio admin path for artwork and order management.

## 15. Source Files Inspected

- `/Users/jaygolding/jga-studio/package.json`
- `/Users/jaygolding/jga-studio/app.json`
- `/Users/jaygolding/jga-studio/app/_layout.tsx`
- `/Users/jaygolding/jga-studio/app/(tabs)/_layout.tsx`
- `/Users/jaygolding/jga-studio/app/(tabs)/index.tsx`
- `/Users/jaygolding/jga-studio/app/(tabs)/discover.tsx`
- `/Users/jaygolding/jga-studio/app/(tabs)/auctions.tsx`
- `/Users/jaygolding/jga-studio/app/(tabs)/profile.tsx`
- `/Users/jaygolding/jga-studio/app/artwork/[id].tsx`
- `/Users/jaygolding/jga-studio/components/ArtworkDetailImpl.native.tsx`
- `/Users/jaygolding/jga-studio/components/ArtworkDetailImpl.web.tsx`
- `/Users/jaygolding/jga-studio/app/notifications.tsx`
- `/Users/jaygolding/jga-studio/hooks/useBetaAccess.ts`
- `/Users/jaygolding/jga-studio/components/BetaGate.tsx`
- `/Users/jaygolding/jga-studio/supabaseClient.ts`
- `/Users/jaygolding/jga-studio/supabase/functions/create-payment-intent/index.ts`
- `/Users/jaygolding/jga-studio/supabase/functions/create-checkout-session/index.ts`
- `/Users/jaygolding/jga-studio/supabase/functions/claim-rewards/index.ts`
- `/Users/jaygolding/jga-studio/privyConfig.ts`
- `/Users/jaygolding/jga-studio/appkitConfig.ts`
