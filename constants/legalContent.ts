// Legal copy for the Profile → Legal screen.
//
// EDIT THIS FILE to change the text — it is plain strings, no code. Each
// section renders as a heading followed by its paragraphs.
//
// ⚠️ DRAFT — NOT LEGAL ADVICE, NOT YET IN FORCE.
// Drafted from Jay's answers about how JGA Studio operates plus research into
// NJ sales-tax rules, auction law, fine-art shipping norms, and crypto-rewards
// disclosure practice, then revised against a legal review (the "Publication
// Readiness Issue List"). Bracketed [[...]] marks something still open.
//
// GO / NO-GO — the reviewer's checklist; do NOT publish (do NOT remove the
// draft banner or clear the [[...]] notes) until all of these are true:
//   □ Entity status is accurate (Jay Golding d/b/a JGA Studio until the LLC
//     is actually formed — do not present the LLC as the operator before then).
//   □ The contact inbox (notices@jgastudio.art) exists and is monitored.
//   □ NJ sales-tax registration + checkout tax collection confirmed with an
//     accountant, and the tax wording matches what checkout actually does.
//   □ The Disclaimers / Limitation of Liability section is written by an
//     attorney (still a placeholder below — do not ship without it).
//   □ Auction default/suspension and $JGA reward language reviewed by counsel.
//
// Reserve limited-scope outside counsel for the highest-risk sections:
// liability/disclaimers, auction default remedies, and the $JGA reward terms.
//
// Separately from this file (checkout/dev work, not legal copy):
//   - a "I agree to the Terms" checkbox at purchase/bid/account creation;
//   - checkout that blocks restricted destinations and shows the crypto
//     network/address/amount/deadline with a required acknowledgment;
//   - checkout configured to actually collect NJ sales tax.

export const LAST_UPDATED = 'Draft — not yet in force';

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalDocument = {
  key: 'terms' | 'privacy';
  tabLabel: string;
  title: string;
  intro: string;
  sections: LegalSection[];
};

// Shared facts, so Terms and Privacy stay consistent.
//
// The review advised NOT presenting JGA Studio LLC as the operator until it is
// actually formed, so the current operator is Jay Golding doing business as JGA
// Studio. When the LLC is registered, change ENTITY to 'JGA Studio LLC' and
// ENTITY_STATUS to name it as a New Jersey LLC.
const ENTITY = 'Jay Golding, doing business as JGA Studio';
const ENTITY_STATUS =
  'JGA Studio is operated by Jay Golding, doing business as JGA Studio. ' +
  '[[When JGA Studio LLC is formed, update this to name the LLC as a New ' +
  'Jersey limited liability company.]]';
// The reviewer specifically advised against a legal@ address (it implies an
// in-house legal team) and recommended a neutral notices@ inbox for everything.
const CONTACT_EMAIL = 'notices@jgastudio.art';
const CONTACT_NOTE = '[[create and monitor this inbox before publishing]]';

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    key: 'terms',
    tabLabel: 'Terms & Conditions',
    title: 'Terms and Conditions',
    intro:
      'These terms govern your use of JGA Studio and any purchase of original ' +
      'artwork or edition through it. By buying, bidding, or creating an ' +
      'account, you agree to them. Please read the auction, shipping, and ' +
      'rewards sections closely.',
    sections: [
      {
        heading: 'Who you are dealing with',
        paragraphs: [
          ENTITY_STATUS,
          `In these terms, "the studio", "we", and "us" mean ${ENTITY}. "You" ` +
            'means the person browsing, bidding, or buying. Notices and ' +
            `questions about these terms, orders, or the website may be sent ` +
            `to ${CONTACT_EMAIL}. ${CONTACT_NOTE}`,
        ],
      },
      {
        heading: 'Ordering and prices',
        paragraphs: [
          'Each artwork is an original or a limited item, so quantities are ' +
            'limited and a piece may sell while you are viewing it. Prices are ' +
            'shown in US dollars and are set by the studio at the time of sale; ' +
            'the price and any tax and shipping are confirmed to you at ' +
            'checkout before you pay.',
          'An order is a request to buy. A sale is complete only when the ' +
            'studio accepts your order and payment has cleared. If a piece is ' +
            'unavailable, mispriced, or payment does not clear, we may decline ' +
            'or cancel the order and refund anything already paid.',
        ],
      },
      {
        heading: 'Payment',
        paragraphs: [
          'Card payments are handled by our payment processor. USDC payments ' +
            'are made on the Base network to the address shown at checkout. In ' +
            'both cases the amount owed is calculated and confirmed by the ' +
            'studio at checkout — never send funds outside the checkout flow.',
          'Crypto payments are final and irreversible. Sending the wrong ' +
            'amount, using the wrong network, or sending to any address other ' +
            'than the one shown at checkout may result in a permanent loss that ' +
            'the studio cannot recover or refund. Only pay through the ' +
            'checkout, which sets the correct network, address, and amount for ' +
            'you, and complete payment before the checkout quote expires.',
          'If a crypto payment is late, underpaid, overpaid, or sent after the ' +
            'quote expires, contact the studio and we will work with you to ' +
            'resolve it; we may cancel the order, and any refund of recoverable ' +
            'funds is net of network fees and made only to the wallet the ' +
            'payment came from. [[Confirm the exact handling you want for late ' +
            '/ under / over / expired crypto payments.]]',
        ],
      },
      {
        heading: 'Sales tax',
        paragraphs: [
          'New Jersey charges 6.625% sales tax on tangible personal property, ' +
            'which includes original paintings, drawings, and similar works. ' +
            'Whether tax applies to your order depends on where the work is ' +
            'delivered.',
          'Once the studio is registered to collect New Jersey sales tax, ' +
            'orders delivered to a New Jersey address will have 6.625% tax ' +
            'added to the item and any taxable delivery charge. Orders ' +
            'delivered outside New Jersey are not charged New Jersey sales tax; ' +
            'you may owe use tax or local tax in your own state or country, ' +
            'which is your responsibility.',
          '[[Do not publish this section until the studio holds a New Jersey ' +
            'Certificate of Authority AND checkout is configured to collect the ' +
            'tax. Until then this describes a future state, not what happens ' +
            'today — confirm with your accountant.]]',
        ],
      },
      {
        heading: 'Shipping and delivery',
        paragraphs: [
          'The studio ships within about 2 to 3 business days of an order ' +
            'clearing, though larger or fragile originals may take longer to ' +
            'pack and book. You will receive tracking once the work is on its ' +
            'way. Delivery timelines after dispatch depend on the carrier and ' +
            'destination and are estimates, not guarantees.',
          'Original works are packed for their medium and insured in transit. ' +
            'Title and risk of loss pass to you on delivery to your address.',
          'We ship only to destinations permitted under United States export ' +
            'and trade rules. We do not ship to any country or region subject ' +
            'to a US embargo or trade restriction, and we may decline or cancel ' +
            'any order we cannot lawfully fulfill.',
          'For international orders, any customs duties, import taxes, or ' +
            'clearance fees are the responsibility of the buyer and are not ' +
            'included in the price or shipping charge.',
        ],
      },
      {
        heading: 'Returns and cancellations',
        paragraphs: [
          'Because these are original works, sales are final once a piece has ' +
            'shipped. For these terms, an order has "shipped" when it has been ' +
            'handed to the carrier — not when a label is created.',
          'You may cancel an order any time before it has been handed to the ' +
            'carrier, for a full refund. Card refunds are returned to the card ' +
            'used; crypto refunds are made to the wallet the payment came from, ' +
            'net of network fees.',
          'If a work arrives damaged in transit, notify the studio within 7 ' +
            'days of delivery. Keep all packaging and send photos of the ' +
            'artwork, the damage, the outer shipping box, the interior ' +
            'packaging, and the shipping label — these are needed to document ' +
            'the carrier insurance claim. Where a work is damaged in shipping ' +
            'to you, you may return it and the studio covers return shipping.',
        ],
      },
      {
        heading: 'Auctions and bidding',
        paragraphs: [
          'Some works are sold by timed auction. Placing a bid is a binding ' +
            'offer to buy at that amount. A bid cannot be retracted once ' +
            'placed, and the highest bid at the close of the auction wins — the ' +
            'close of the auction is the point of sale, the equivalent of the ' +
            'fall of the hammer.',
          'JGA Studio auctions do not use hidden reserves. The starting price ' +
            'is the real starting price.',
          'If you win, you must complete payment within 48 hours of the ' +
            'auction closing. You will get a reminder when the auction closes ' +
            'and a final notice before the deadline, which states the exact ' +
            'expiration time.',
          'If a winning bidder does not pay within 48 hours, the studio may ' +
            'treat the bidder as in default and cancel the sale. We may then ' +
            'offer the work to the next-highest bidder, relist it, or reopen ' +
            'bidding, and we may restrict or suspend the non-paying account from ' +
            'future auctions.',
          '[[ATTORNEY REVIEW: have counsel finalize the auction rules — bid ' +
            'retraction, close timing, payment deadlines, technical errors or ' +
            'platform outages, suspected fraud or manipulation, non-paying ' +
            'bidders, next-highest-bidder offers, and account suspensions — so ' +
            'they are clear and enforceable.]]',
        ],
      },
      {
        heading: 'Authenticity and provenance',
        paragraphs: [
          'Each work is created by Jay Golding and documented in the studio’s ' +
            'provenance record. The record shows the work’s history and ' +
            'details as held by the studio; it is a record of provenance, not a ' +
            'guarantee of future value or condition.',
        ],
      },
      {
        heading: 'Copyright and reproduction',
        paragraphs: [
          'When you buy a physical work, you own that object. You do not ' +
            'receive the copyright, and no copyright transfers unless the ' +
            'artist agrees to it separately in writing. Jay Golding retains all ' +
            'copyright and reproduction rights in the work and its images, ' +
            'including the right to reproduce, exhibit, and license them.',
          'As the owner, you are welcome to photograph the work you own and ' +
            'share those photos for personal, non-commercial purposes. Without ' +
            'the artist’s written permission you may not use the work or its ' +
            'images commercially (prints, merchandise, advertising, or resale ' +
            'reproductions), sublicense any rights, mint the work as an NFT or ' +
            'digital collectible, or use the work or its images to train AI ' +
            'models or build datasets.',
        ],
      },
      {
        heading: 'Studio rewards ($JGA)',
        paragraphs: [
          'As a thank-you for supporting the studio, we may give you ' +
            'JGA_STUDIO ($JGA) as a reward. $JGA is a creator token on the Zora ' +
            'platform on the Base network. We are not selling it to you and are ' +
            'not asking you to buy it — it is a perk for collecting work or ' +
            'otherwise supporting the studio.',
          '$JGA trades on a public market, so its value changes constantly and ' +
            'can fall to zero. Receiving a reward is not an investment, a ' +
            'profit opportunity, a revenue share, or financial or investment ' +
            'advice, and you should not buy artwork for the value of the token. ' +
            'Cryptocurrency is volatile and risky, and you accept that risk ' +
            'when you claim or hold $JGA. The studio does not promise any ' +
            'value, price, or future for the token, and may change or end the ' +
            'rewards program at any time.',
          'Rewards may not be available everywhere. They are void where ' +
            'prohibited and subject to sanctions and eligibility rules, and a ' +
            'compatible wallet is required to claim. [[Confirm any age, ' +
            'geographic, or wallet eligibility limits you want to state.]]',
          'Claiming or holding $JGA may have tax consequences for you. You are ' +
            'responsible for any taxes on rewards you receive; please consult ' +
            'your own tax advisor.',
          '[[Before publishing: confirm the studio’s own tax treatment of ' +
            'rewards with an accountant, and have counsel review this section. ' +
            'Keep it factual — do not assert a legal classification of the ' +
            'token.]]',
        ],
      },
      {
        heading: 'Disclaimers and limitation of liability',
        paragraphs: [
          '[[ATTORNEY-DRAFTED SECTION REQUIRED — do not publish the Terms ' +
            'without it. This is the studio’s warranty disclaimer and liability ' +
            'cap, and its wording has real legal effect. A New Jersey attorney ' +
            'should write or approve language covering at least: the condition ' +
            'of original artwork; that website photos may differ in color or ' +
            'detail from the physical work; payment-processor issues; crypto ' +
            'transaction risks; shipping delays or carrier failures; exclusion ' +
            'of indirect, incidental, special, and consequential damages; a ' +
            'maximum liability cap; and the exclusions that cannot legally be ' +
            'excluded under applicable law.]]',
        ],
      },
      {
        heading: 'Changes and governing law',
        paragraphs: [
          'We may update these terms as the studio grows; the version in force ' +
            'is the one posted here, and material changes take effect when ' +
            'posted. These terms are governed by the laws of the State of New ' +
            'Jersey, without regard to its conflict-of-laws rules.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [
          `Questions about these terms or an order can go to ${CONTACT_EMAIL}. ${CONTACT_NOTE}`,
        ],
      },
    ],
  },
  {
    key: 'privacy',
    tabLabel: 'Privacy',
    title: 'Privacy Policy',
    intro:
      'This explains what JGA Studio collects about you, why, who we share it ' +
      'with, and the choices you have. We collect only what we need to sell ' +
      'and ship artwork and run your account.',
    sections: [
      {
        heading: 'Who is responsible for your data',
        paragraphs: [
          ENTITY_STATUS,
          `Privacy questions and requests can go to ${CONTACT_EMAIL}. ${CONTACT_NOTE}`,
        ],
      },
      {
        heading: 'What we collect',
        paragraphs: [
          'Account and contact details: the email address you sign in with, ' +
            'and a display name and profile photo if you choose to add them.',
          'Order details: what you bought or bid on, the shipping address you ' +
            'provide, and the status of your orders. Card details are entered ' +
            'directly with our payment processor and are not stored by the ' +
            'studio.',
          'Wallet and onchain details: any blockchain wallet address connected ' +
            'to your account, and the reward and payment activity tied to it.',
          'Saved works: the pieces you add to your wishlist, so they are there ' +
            'when you come back.',
        ],
      },
      {
        heading: 'How we use it',
        paragraphs: [
          'To take and fulfill orders, arrange shipping, process payments, run ' +
            'auctions, issue rewards, respond to you, keep the required tax and ' +
            'sales records, and prevent fraud and abuse. We do not sell your ' +
            'personal information.',
        ],
      },
      {
        heading: 'Who we share it with',
        paragraphs: [
          'We share data only with the service providers that make the studio ' +
            'work, and only what each one needs: authentication and wallet ' +
            'infrastructure (Privy), our database and file storage (Supabase), ' +
            'card payment processing (Stripe), and shipping carriers for ' +
            'delivery. [[If you add a crypto on-ramp such as MoonPay, name it ' +
            'here and link its privacy policy.]] We may also disclose ' +
            'information where the law requires it.',
        ],
      },
      {
        heading: 'Onchain information is public and permanent',
        paragraphs: [
          'Blockchain transactions — including USDC payments and $JGA rewards ' +
            'on the Base network — are recorded on a public ledger. A wallet ' +
            'address and its transaction history are public, permanent, and ' +
            'outside the studio’s control. They cannot be edited or deleted, by ' +
            'us or by anyone. Keep this in mind when you connect a wallet.',
        ],
      },
      {
        heading: 'Cookies and local storage',
        paragraphs: [
          'The app uses your device’s local storage to keep you signed in and ' +
            'to remember things like your saved works and theme. It does not ' +
            'depend on third-party advertising trackers.',
        ],
      },
      {
        heading: 'How long we keep it',
        paragraphs: [
          'We keep account information while your account is active. We keep ' +
            'order and payment records for as long as needed to meet tax, ' +
            'accounting, and legal obligations — for sales records this is ' +
            'generally several years. [[Confirm the retention period with your ' +
            'accountant; New Jersey and federal record-keeping is commonly ' +
            'about 7 years.]] Onchain records, as noted above, are permanent ' +
            'and cannot be deleted.',
        ],
      },
      {
        heading: 'Your choices',
        paragraphs: [
          'You can view and update your display name and photo in your ' +
            'profile, and you can ask us for a copy of your personal data, ask ' +
            'us to correct it, or ask us to delete it, subject to records we ' +
            `must keep by law. Email ${CONTACT_EMAIL} and we will respond ` +
            'within a reasonable time. [[Set a target, e.g. within 30 days.]] ' +
            'Onchain data cannot be deleted.',
        ],
      },
      {
        heading: 'Children',
        paragraphs: [
          'JGA Studio is not directed to children, and we do not knowingly ' +
            'collect information from anyone under 18. [[Confirm the minimum ' +
            'age you want to require to buy or bid.]]',
        ],
      },
      {
        heading: 'Changes and contact',
        paragraphs: [
          'We may update this policy as the studio grows; the version posted ' +
            `here is the current one. Questions or requests: ${CONTACT_EMAIL}. ${CONTACT_NOTE}`,
        ],
      },
    ],
  },
];
