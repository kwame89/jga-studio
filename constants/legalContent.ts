// Legal copy for the Profile → Legal screen.
//
// EDIT THIS FILE to change the text — it is plain strings, no code. Each
// section renders as a heading followed by its paragraphs.
//
// ⚠️ DRAFT — NOT LEGAL ADVICE, NOT YET IN FORCE.
// This was drafted from Jay's answers about how JGA Studio actually operates
// plus research into New Jersey sales-tax rules, standard auction law, fine-art
// shipping norms, and crypto-rewards disclosure practice. It is written to be
// clear and honest, but it must be reviewed by a licensed attorney and cannot
// govern a real sale until (a) JGA Studio LLC is registered, (b) the contact
// addresses/emails exist, and (c) that review is done. Bracketed [[...]] marks
// a fact that is not settled yet — fill each one before publishing, then set
// LAST_UPDATED to the go-live date.
//
// Attorney / accountant priorities, in order:
//   1. Studio Rewards ($JGA) — this is a TAX question, not a securities one.
//      Per the SEC Division of Corporation Finance staff statement (Feb 2025), a
//      meme-style token given as a reward rather than sold as an investment is
//      generally outside the securities analysis: a free reward involves no
//      "investment of money" by the recipient, which is the first Howey prong.
//      The live issue is tax — crypto rewards are ordinary income to the
//      recipient at fair-market value when they can move them, and the studio's
//      own treatment of giving tokens for purchases should be confirmed with an
//      accountant. Do NOT assert a token classification ("meme coin", "not a
//      security") in the terms; state facts, not legal conclusions.
//   2. Auction default / account suspension terms (section: Auctions).
//   3. Limitation of liability and disclaimers (currently a marked placeholder).

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

// Shared facts, so Terms and Privacy stay consistent. Replace the bracketed
// values once they exist.
const ENTITY = 'JGA Studio LLC';
const ENTITY_STATUS =
  'JGA Studio is operated by JGA Studio LLC, a New Jersey limited liability ' +
  'company (registration in progress). Until registration completes, the ' +
  'studio is operated by Jay Golding as the artist.';
const LEGAL_EMAIL = '[[legal@jgastudio.art — create before publishing]]';
const PRIVACY_EMAIL = '[[privacy@jgastudio.art — create before publishing]]';
const LEGAL_ADDRESS =
  '[[registered-agent mailing address — add before publishing]]';

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    key: 'terms',
    tabLabel: 'Terms & Conditions',
    title: 'Terms and Conditions',
    intro:
      'These terms govern your use of JGA Studio and any purchase of original ' +
      'artwork, edition, or digital item through it. By buying, bidding, or ' +
      'creating an account, you agree to them. Please read the auction, ' +
      'shipping, and rewards sections closely.',
    sections: [
      {
        heading: 'Who you are dealing with',
        paragraphs: [
          ENTITY_STATUS,
          `In these terms, "the studio", "we", and "us" mean ${ENTITY} and Jay ` +
            'Golding. "You" means the person browsing, bidding, or buying. ' +
            `Legal notices to the studio should go to ${LEGAL_EMAIL}` +
            (LEGAL_ADDRESS.startsWith('[[')
              ? '.'
              : ` or ${LEGAL_ADDRESS}.`),
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
            'checkout, which sets the correct network and amount for you.',
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
          '[[Confirm before publishing: the studio is registered for a New ' +
            'Jersey Certificate of Authority and is collecting sales tax. Until ' +
            'then, do not state that tax is being collected.]]',
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
            'to a US embargo or trade restriction, and we may decline any order ' +
            'we cannot lawfully fulfill.',
          'For international orders, any customs duties, import taxes, or ' +
            'clearance fees are the responsibility of the buyer and are not ' +
            'included in the price or shipping charge.',
        ],
      },
      {
        heading: 'Returns and cancellations',
        paragraphs: [
          'Because these are original works, sales are final once a piece has ' +
            'shipped. Please consider a purchase carefully before completing it.',
          'If a work arrives damaged in transit, contact the studio promptly ' +
            'with photographs of the packaging and the damage. Where a work is ' +
            'damaged in shipping to you, you may return it and the studio will ' +
            'cover return shipping. [[Confirm the claim window you want, e.g. ' +
            'notify within 7 days of delivery.]]',
          'You may cancel an order any time before it ships for a full refund. ' +
            'Once a work has been dispatched it can no longer be cancelled. The ' +
            'practical cancellation window depends on the shipping service ' +
            'chosen and how soon the work is prepared for dispatch.',
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
            'future auctions. [[Attorney: confirm these default and ' +
            'account-suspension terms are enforceable as written.]]',
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
            'receive the copyright. Jay Golding retains all copyright and ' +
            'reproduction rights in the work and its images, including the ' +
            'right to reproduce, exhibit, and license them.',
          'As the owner, you are welcome to photograph the work you own and ' +
            'share those photos for personal, non-commercial purposes. Using ' +
            'the work or its images commercially — for prints, merchandise, ' +
            'advertising, or resale of reproductions — requires the artist’s ' +
            'written permission.',
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
            'can fall to zero. Receiving a reward is not an investment and is ' +
            'not financial or investment advice. Cryptocurrency is volatile and ' +
            'risky, and you accept that risk when you claim or hold $JGA. The ' +
            'studio does not promise any value, price, or future for the token, ' +
            'and may change or end the rewards program at any time.',
          'Claiming or holding $JGA may have tax consequences for you. You are ' +
            'responsible for any taxes on rewards you receive; please consult ' +
            'your own tax advisor.',
          '[[Before publishing: confirm the studio’s own tax treatment of ' +
            'rewards with an accountant. Keep this section factual — do not add ' +
            'a legal classification of the token.]]',
        ],
      },
      {
        heading: 'Disclaimers and limitation of liability',
        paragraphs: [
          '[[ATTORNEY-DRAFTED SECTION NEEDED. This is where the studio’s ' +
            'warranty disclaimers and the cap on its liability belong. The ' +
            'wording has real legal effect and should be written or approved by ' +
            'a lawyer for New Jersey, not drafted here.]]',
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
          `Questions about these terms or an order can go to ${LEGAL_EMAIL}.`,
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
          `Privacy questions and requests can go to ${PRIVACY_EMAIL}.`,
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
            `must keep by law. Email ${PRIVACY_EMAIL} and we will respond ` +
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
            'here is the current one. Questions or requests: ' +
            `${PRIVACY_EMAIL}.`,
        ],
      },
    ],
  },
];
