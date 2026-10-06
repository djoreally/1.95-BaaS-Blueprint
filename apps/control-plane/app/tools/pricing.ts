/**
 * InvisibleDB billing tools — shared public list-price model.
 *
 * Every rate below comes from a cited public source (see SOURCES).
 * These are list prices only: real bills vary by region, usage pattern,
 * discounts, and products we deliberately do not model (egress, deletes,
 * functions, SMS, compute add-ons). The tool pages state that plainly.
 */

// ---------------------------------------------------------------------------
// Firebase (Blaze pay-as-you-go)
// ---------------------------------------------------------------------------

export const FIREBASE = {
  /** Region the per-operation prices below are quoted for. Multi-region costs more. */
  regionNote: 'us-central1',
  readsPer100k: 0.03,
  writesPer100k: 0.09,
  deletesPer100k: 0.01,
  freeReadsPerDay: 50_000,
  freeWritesPerDay: 20_000,
  freeDeletesPerDay: 20_000,
  authFreeMau: 50_000,
  /** Cumulative upper bound, rate per MAU — Identity Platform tiers beyond the 50K free tier. */
  authTiers: [
    [100_000, 0.0055],
    [1_000_000, 0.0046],
    [10_000_000, 0.0032],
    [Infinity, 0.0025],
  ] as [number, number][],
  storageFreeGb: 5,
  storagePerGb: 0.026, // legacy *.appspot.com buckets; new buckets bill at Cloud Storage list rates
};

export function authMauCost(mau: number): number {
  let billable = Math.max(0, mau - FIREBASE.authFreeMau);
  let cost = 0;
  let prevLimit = FIREBASE.authFreeMau;
  for (const [limit, rate] of FIREBASE.authTiers) {
    if (billable <= 0) break;
    const take = Math.min(billable, limit - prevLimit);
    cost += take * rate;
    billable -= take;
    prevLimit = limit;
  }
  return cost;
}

export interface FirebaseInputs {
  mau: number;
  readsPerUserPerDay: number;
  writesPerUserPerDay: number;
  storageGb: number;
}

export interface FirebaseLineItem {
  label: string;
  detail: string;
  cost: number;
}

export interface FirebaseEstimate {
  lines: FirebaseLineItem[];
  total: number;
  monthlyReads: number;
  monthlyWrites: number;
}

export function estimateFirebase(i: FirebaseInputs): FirebaseEstimate {
  const monthlyReads = i.mau * i.readsPerUserPerDay * 30;
  const billableReads = Math.max(0, monthlyReads - FIREBASE.freeReadsPerDay * 30);
  const readCost = (billableReads / 100_000) * FIREBASE.readsPer100k;

  const monthlyWrites = i.mau * i.writesPerUserPerDay * 30;
  const billableWrites = Math.max(0, monthlyWrites - FIREBASE.freeWritesPerDay * 30);
  const writeCost = (billableWrites / 100_000) * FIREBASE.writesPer100k;

  const authCost = authMauCost(i.mau);

  const billableStorage = Math.max(0, i.storageGb - FIREBASE.storageFreeGb);
  const storageCost = billableStorage * FIREBASE.storagePerGb;

  const lines: FirebaseLineItem[] = [
    {
      label: 'Firestore reads',
      detail: `${fmtCompact(monthlyReads)} reads/mo · 1.5M free · $0.03 / 100K after`,
      cost: readCost,
    },
    {
      label: 'Firestore writes',
      detail: `${fmtCompact(monthlyWrites)} writes/mo · 600K free · $0.09 / 100K after`,
      cost: writeCost,
    },
    {
      label: 'Auth — monthly active users',
      detail: `${fmtInt(i.mau)} MAU · 50K free · then $0.0055 → $0.0025 / MAU tiered`,
      cost: authCost,
    },
    {
      label: 'Cloud Storage — file storage',
      detail: `${fmtInt(i.storageGb)} GB · 5 GB free · $0.026 / GB after`,
      cost: storageCost,
    },
  ];

  return {
    lines,
    total: readCost + writeCost + authCost + storageCost,
    monthlyReads,
    monthlyWrites,
  };
}

// ---------------------------------------------------------------------------
// Supabase (Pro plan)
// ---------------------------------------------------------------------------

export const SUPABASE = {
  proBase: 25,
  includedMau: 100_000,
  mauOverage: 0.00325,
  includedFileStorageGb: 100,
  fileStorageOverage: 0.021,
  includedBandwidthGb: 250,
  bandwidthOverage: 0.09, // assumed within quota by the model; stated, not silently charged
};

export interface SupabaseEstimate {
  base: number;
  mauOverage: number;
  storageOverage: number;
  total: number;
}

export function estimateSupabase(i: { mau: number; storageGb: number }): SupabaseEstimate {
  const mauOverage = Math.max(0, i.mau - SUPABASE.includedMau) * SUPABASE.mauOverage;
  const storageOverage =
    Math.max(0, i.storageGb - SUPABASE.includedFileStorageGb) * SUPABASE.fileStorageOverage;
  return {
    base: SUPABASE.proBase,
    mauOverage,
    storageOverage,
    total: SUPABASE.proBase + mauOverage + storageOverage,
  };
}

// ---------------------------------------------------------------------------
// PocketHost + InvisibleDB (given pricing)
// ---------------------------------------------------------------------------

export const POCKETHOST_PER_SEAT = 9.99; // given
export const INVISIBLEDB_PER_SEAT = 6.99; // given
export const INVISIBLEDB_FIRST_SEAT = 1; // given — matches the site pricing page

export function estimatePocketHost(seats: number): number {
  return Math.max(0, seats) * POCKETHOST_PER_SEAT;
}

export function estimateInvisibleDb(seats: number): number {
  if (seats <= 0) return 0;
  return INVISIBLEDB_FIRST_SEAT + (seats - 1) * INVISIBLEDB_PER_SEAT;
}

// ---------------------------------------------------------------------------
// Sources — every price above, cited with an as-of date.
// ---------------------------------------------------------------------------

export interface PricingSource {
  label: string;
  detail: string;
  asOf: string;
  url?: string;
}

export const SOURCES: PricingSource[] = [
  {
    label: 'Firestore pricing — Google Cloud',
    detail:
      'Standard edition, us-central1: $0.03 / 100K reads, $0.09 / 100K writes, $0.01 / 100K deletes. Free: 50K reads, 20K writes, 20K deletes per day.',
    asOf: 'Oct 2026',
    url: 'https://cloud.google.com/firestore/pricing',
  },
  {
    label: 'Firestore Enterprise pricing — Firebase docs',
    detail:
      'Standard vs Enterprise edition rate table, us-central1 (Standard edition rates match the Cloud table).',
    asOf: 'Oct 2026',
    url: 'https://firebase.google.com/docs/firestore/enterprise/pricing',
  },
  {
    label: 'Firebase Pricing page',
    detail:
      'Auth free up to 50K MAU, then Identity Platform pricing. Cloud Storage legacy buckets: 5 GB stored free then $0.026 / GB; 1 GB / day downloads free then $0.12 / GB.',
    asOf: 'Oct 2026',
  },
  {
    label: 'Firebase Authentication pricing — Logto analysis',
    detail:
      'Tier 1 MAU tiers: $0.0055 (50–100K), $0.0046 (100K–1M), $0.0032 (1M–10M), $0.0025 (10M+). Phone-auth SMS $0.01–$0.46 per send by region.',
    asOf: 'Jul 2026',
    url: 'https://blog.logto.io/firebase-authentication-pricing',
  },
  {
    label: 'Supabase pricing 2026 — ShipAI',
    detail:
      'Free: 500 MB DB, 5 GB bandwidth, 1 GB storage, 50K MAU. Pro $25 / mo per project: 8 GB DB, 250 GB bandwidth, 100 GB storage, 100K MAU.',
    asOf: '2026',
    url: 'https://shipai.today/vibe-coding/supabase-pricing',
  },
  {
    label: 'Supabase pricing 2026 — Dev.to',
    detail:
      'Pro overages: DB $0.125 / GB, bandwidth $0.09 / GB, file storage $0.021 / GB, MAU $0.00325 / MAU, edge functions $2 / million invocations.',
    asOf: 'Sep 2026',
    url: 'https://dev.to/nayankyada/supabase-pricing-2026-free-tier-limits-compute-costs-when-to-upgrade-52af',
  },
  {
    label: 'PocketHost pricing',
    detail: '$9.99 per seat, as specified for this comparison.',
    asOf: 'Oct 2026',
  },
  {
    label: 'InvisibleDB pricing',
    detail: '$6.99 / mo per seat, first month $1 — matches the InvisibleDB pricing page.',
    asOf: 'Oct 2026',
  },
];

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtMoneyRound(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function fmtCompact(n: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

// ---------------------------------------------------------------------------
// MAU slider: exponential 1K → 500K over a 0–100 slider
// ---------------------------------------------------------------------------

export const MAU_MIN = 1_000;
export const MAU_MAX = 500_000;

export function sliderToMau(v: number): number {
  return Math.round(MAU_MIN * Math.pow(MAU_MAX / MAU_MIN, v / 100));
}

export function mauToSlider(m: number): number {
  return Math.round((100 * Math.log(m / MAU_MIN)) / Math.log(MAU_MAX / MAU_MIN));
}
