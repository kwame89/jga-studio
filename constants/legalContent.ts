// Legal copy for the Profile → Legal screen.
//
// EDIT THIS FILE to change the text — it is plain strings, no code. Each
// section renders as a heading followed by its paragraphs. Add, remove, or
// reorder sections freely.
//
// ⚠️ THE TEXT BELOW IS A PLACEHOLDER SKELETON, NOT LEGAL ADVICE. It marks out
// the sections a studio selling original artwork typically needs so the screen
// has real structure — but the wording must be reviewed and replaced by you or
// your attorney before it governs a real sale. Update LAST_UPDATED when you do.

export const LAST_UPDATED = 'Not yet published';

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

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    key: 'terms',
    tabLabel: 'Terms & Conditions',
    title: 'Terms and Conditions',
    intro:
      'These terms govern your use of JGA Studio and any purchase of original ' +
      'artwork, edition, or digital item through it.',
    sections: [
      {
        heading: 'Placeholder — replace before launch',
        paragraphs: [
          'This screen is wired up and ready, but the wording has not been ' +
            'written or reviewed yet. Replace every section in ' +
            'constants/legalContent.ts with your own terms.',
        ],
      },
      {
        heading: 'Purchases and payment',
        paragraphs: [
          'Describe how an order is placed, when it is binding, which payment ' +
            'methods are accepted (card and USDC on Base), and how prices and ' +
            'sales tax are calculated.',
        ],
      },
      {
        heading: 'Shipping and delivery',
        paragraphs: [
          'Describe shipping rates and zones, who bears customs and duties, ' +
            'delivery timelines, and which destinations you cannot ship to.',
        ],
      },
      {
        heading: 'Returns and cancellations',
        paragraphs: [
          'Describe whether a sale is final once shipped, and the window in ' +
            'which a buyer may cancel before dispatch.',
        ],
      },
      {
        heading: 'Auctions and bidding',
        paragraphs: [
          'Describe how bids are placed, when a bid becomes binding, reserve ' +
            'prices, bid increments, closing rules, and the deadline for ' +
            'settling a winning lot.',
        ],
      },
      {
        heading: 'Authenticity and provenance',
        paragraphs: [
          'Describe what the provenance record represents and what is and is ' +
            'not warranted about a work.',
        ],
      },
      {
        heading: 'Copyright and reproduction',
        paragraphs: [
          'Buying a physical work does not transfer copyright. State what ' +
            'rights the artist retains over the images and the work itself.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: ['Give the address collectors should use for legal notices.'],
      },
    ],
  },
  {
    key: 'privacy',
    tabLabel: 'Privacy',
    title: 'Privacy Policy',
    intro:
      'How JGA Studio collects, uses, and stores information about collectors.',
    sections: [
      {
        heading: 'Placeholder — replace before launch',
        paragraphs: [
          'This screen is wired up and ready, but the wording has not been ' +
            'written or reviewed yet. Replace every section in ' +
            'constants/legalContent.ts with your own policy.',
        ],
      },
      {
        heading: 'What is collected',
        paragraphs: [
          'Describe the data the studio holds: the email used to sign in, ' +
            'display name and profile photo if provided, order and shipping ' +
            'details, and wallet addresses connected to the account.',
        ],
      },
      {
        heading: 'Service providers',
        paragraphs: [
          'Name the processors that handle collector data on your behalf and ' +
            'what each one receives.',
        ],
      },
      {
        heading: 'Onchain information',
        paragraphs: [
          'Explain that blockchain transactions are public and permanent, and ' +
            'that a wallet address and its activity cannot be deleted.',
        ],
      },
      {
        heading: 'Retention',
        paragraphs: [
          'State how long order records are kept and why, including any tax or ' +
            'accounting obligations.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          'Describe how a collector requests a copy of their data, corrects it, ' +
            'or asks for deletion, and how long you take to respond.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: ['Give the address collectors should use for privacy requests.'],
      },
    ],
  },
];
