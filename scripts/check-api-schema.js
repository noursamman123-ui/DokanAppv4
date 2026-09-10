#!/usr/bin/env node
/**
 * Pulls a handful of live, unauthenticated API responses and diffs their
 * field names against the shapes the app's TypeScript types (src/types/index.ts)
 * assume. Every bug in the 2026-08 audit that mattered (cart totals field
 * names, missing order line-item fields, wrong profile endpoint) was this
 * exact category of failure — a hand-written type silently drifting from
 * what the server actually returns — and nothing caught it until someone
 * hit the bug live in the app.
 *
 * This does NOT replace real typed codegen (e.g. openapi-typescript against
 * a published schema); WooCommerce's Store API doesn't publish one. It's the
 * cheap version: run it before a release, read the report, fix drift by hand.
 *
 * Usage:
 *   node scripts/check-api-schema.js [--base-url https://dokan.com.sy]
 *
 * Exit code is non-zero if any REQUIRED field is missing from a live
 * response, so this can be wired into a release checklist or CI later.
 *
 * IMPORTANT: keep the `SCHEMAS` list below in sync by hand whenever
 * src/types/index.ts changes for one of the covered endpoints — this file
 * has no way to know that happened automatically.
 */

const BASE_URL =
  process.argv.includes('--base-url')
    ? process.argv[process.argv.indexOf('--base-url') + 1]
    : process.env.DOKAN_API_BASE_URL || 'https://dokan.com.sy';

// Mirrors src/types/index.ts — required (non-`?`) fields only. Nested paths
// use dot notation; `[0]` means "check the first array element, skip silently
// if the array is empty" (e.g. a cart with no items can't check item shape).
const SCHEMAS = [
  {
    label: 'Cart (WC Store API)',
    path: '/wp-json/wc/store/v1/cart',
    checks: [
      { path: '', required: ['items', 'coupons', 'fees', 'totals', 'needs_shipping', 'items_count', 'items_weight'] },
      { path: 'totals', required: [
        'total_items', 'total_items_tax', 'total_fees', 'total_fees_tax',
        'total_shipping', 'total_shipping_tax', 'total_discount', 'total_discount_tax',
        'total_tax', 'total_price', 'currency_code', 'currency_symbol', 'currency_minor_unit',
      ] },
      { path: 'items[0]', required: [
        'key', 'id', 'type', 'quantity', 'quantity_limits', 'name', 'sku',
        'low_stock_remaining', 'sold_individually', 'images', 'prices', 'totals', 'variation',
      ] },
    ],
  },
  {
    label: 'Products list (WC Store API)',
    path: '/wp-json/wc/store/v1/products?per_page=1',
    checks: [
      { path: '[0]', required: [
        'id', 'name', 'slug', 'type', 'description', 'short_description', 'sku',
        'prices', 'on_sale', 'is_purchasable', 'is_in_stock', 'stock_availability',
        'categories', 'images', 'attributes', 'variations', 'review_count',
        'average_rating', 'weight', 'dimensions',
      ] },
      { path: '[0].prices', required: [
        'price', 'regular_price', 'sale_price', 'currency_code', 'currency_symbol',
        'currency_minor_unit', 'currency_decimal_separator', 'currency_thousand_separator',
        'currency_prefix', 'currency_suffix',
      ] },
    ],
  },
  {
    label: 'Home feed (dokan-mobile-api custom endpoint)',
    path: '/wp-json/dokan-mobile/v1/home',
    checks: [
      { path: '', required: ['success', 'data'] },
      // This product shape is FLAT (price/regular_price/sale_price, stock_status,
      // rating_count) — deliberately different from the Store API's nested shape
      // above. `low_stock_remaining` was added to class-home.php's formatter in an
      // earlier fix round but isn't required here yet because that plugin version
      // may not be uploaded/live — run this after confirming the upload to verify.
      { path: 'data.latest_products[0]', required: [
        'id', 'name', 'slug', 'type', 'images', 'categories', 'price',
        'regular_price', 'sale_price', 'on_sale', 'stock_status', 'average_rating',
        'rating_count', 'short_description',
      ] },
    ],
  },
];

function get(obj, path) {
  if (path === '') return obj;
  let cur = obj;
  for (const segment of path.split('.')) {
    if (cur == null) return undefined;
    const arrayMatch = segment.match(/^(\w*)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      cur = key ? cur[key] : cur;
      if (!Array.isArray(cur)) return { __skip: true };
      if (cur.length === 0) return { __skip: true };
      cur = cur[Number(index)];
    } else {
      cur = cur[segment];
    }
  }
  return cur;
}

async function checkEndpoint(schema) {
  const url = `${BASE_URL}${schema.path}`;
  let body;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      return { label: schema.label, url, error: `HTTP ${res.status}` };
    }
    body = await res.json();
  } catch (err) {
    return { label: schema.label, url, error: err.message };
  }

  const problems = [];
  for (const check of schema.checks) {
    const target = get(body, check.path);
    if (target && target.__skip) {
      problems.push({ path: check.path || '(root)', note: 'skipped — array was empty in this response' });
      continue;
    }
    if (!target || typeof target !== 'object') {
      problems.push({ path: check.path || '(root)', missing: check.required, note: 'field itself was missing/not an object' });
      continue;
    }
    const missing = check.required.filter((key) => !(key in target));
    if (missing.length > 0) {
      problems.push({ path: check.path || '(root)', missing });
    }
  }

  return { label: schema.label, url, problems };
}

async function main() {
  console.log(`Checking API schema drift against ${BASE_URL}\n`);

  const results = await Promise.all(SCHEMAS.map(checkEndpoint));
  let hasFailure = false;

  for (const result of results) {
    if (result.error) {
      console.log(`⚠️  ${result.label} — could not check (${result.error})`);
      continue;
    }
    const realProblems = result.problems.filter((p) => p.missing?.length);
    const skipped = result.problems.filter((p) => p.note && !p.missing?.length);

    if (realProblems.length === 0) {
      console.log(`✅ ${result.label} — matches`);
    } else {
      hasFailure = true;
      console.log(`❌ ${result.label} — drift detected:`);
      for (const problem of realProblems) {
        console.log(`   at ${problem.path}: missing ${problem.missing.join(', ')}`);
      }
    }
    for (const s of skipped) {
      console.log(`   (${s.path}: ${s.note})`);
    }
  }

  console.log('');
  if (hasFailure) {
    console.log('Drift found — update src/types/index.ts (and this file) to match reality.');
    process.exit(1);
  }
  console.log('No drift detected in the endpoints this script covers.');
}

main();
