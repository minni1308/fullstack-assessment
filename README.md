## Getting Started

```bash
yarn install
yarn dev
```


## Summary of Changes

| File / Page | Bug(s) Fixed |
|-------------|--------------|
| `app/page.tsx` | 2, 3, 5, 6, 7, 8, 9, 10, 11 |
| `app/product/page.tsx` | 1, 6, 8, 11 |
| `app/layout.tsx` | 4 |
| `app/api/products/route.ts` | 12 |
| `lib/products.ts` | 11 |

## How I Approached the Bugs

I started by using the app—clicking around the product list, filters, search, pagination, and product details,  wrote down everything that broke or felt off. Once I knew what was wrong, I traced the data flow from the UI down to the API and service layer to find where things went sideways. Most of the time it was something simple: a param we never sent, state that got reset too early, or missing validation. I tried to fix things at the source instead of papering over them. Before adding anything new, I checked whether the backend already did what we needed (it usually did subcategory filtering, pagination, SKU lookup were all there). I kept the changes small when I could: a Suspense wrapper here, some optional chaining there. I also spent time on edge cases—invalid URLs, empty responses, the weird race where we’d reset the page before we even knew the total and added guards or sane defaults. For each fix I jotted down the problem, what I did, and why.

## Bugs Fixed

### Bug 1 — Product page build failure (useSearchParams missing Suspense boundary)

**File:** `app/product/page.tsx`

**Problem:**  
The production build failed when trying to prerender the `/product` page. Next.js threw: *"useSearchParams() should be wrapped in a suspense boundary"*. The product page was using `useSearchParams()` directly in the page component to read the `product` query param. Because search params are only known at request time, Next.js cannot statically prerender the page without knowing how to handle that dynamic part. Without a Suspense boundary, the build bails out and fails.

**Fix:**  
The component that uses `useSearchParams()` was moved into a child component and wrapped in `<Suspense>` with a loading fallback. That lets Next.js prerender the page shell and stream the dynamic content when search params are available.

**Why this approach:**  
Next.js explicitly requires Suspense for client-side hooks that depend on request-time data. Extracting the dynamic part into a child component is the minimal change—we kept the rest of the page structure intact. The loading fallback improves perceived performance while the product content loads.

### Bug 2 — Subcategory dropdown showed options from all categories

**File:** `app/page.tsx`

**Problem:**  
Selecting a category such as "Headphones" should restrict the subcategory dropdown to only subcategories that belong to that category (e.g. "Earbud Headphones"). Instead, the dropdown listed subcategories from every category in the catalog. Choosing one would either return mismatched products or none at all.

**Fix:**  
The `/api/subcategories` endpoint accepts a `category` query param to filter results, but the frontend never sent it. The selected category is now passed in the request. Additionally, `selectedSubCategory` is reset whenever the category changes so a subcategory from a previous selection is not left selected.

**Why this approach:**  
The API already supported filtering—the fix was simply passing the value the backend expected. Resetting the subcategory when the category changes prevents invalid combinations (e.g. keeping "Earbud Headphones" selected when switching to "Tablets") and avoids confusing empty results. The reset is done in the `onValueChange` handler (not just in `useEffect`) so the state updates are batched—otherwise the products fetch could run with the old subcategory before the reset is applied, causing a mismatched API request.

### Bug 3 — Category filter UX: no "All" option, Clear Filters wiped search, dropdown not resetting visually

**File:** `app/page.tsx`

**Problem:**  
The category dropdown had no "All Categories" option. Once you selected a category, the only way to undo it was to click "Clear Filters"—which also cleared the search field. If you had typed a search term and then refined by category, clearing the category would wipe your search too. Radix Select could also get stuck showing the last selected value instead of "All Categories" after clearing. The dropdown did not reset visually when clicking Clear Filters.

**Fix:**  
Added explicit "All Categories" and "All Subcategories" options to both dropdowns using a sentinel value so Radix Select receives a valid value and displays correctly after clearing. Removed search from the Clear Filters action—it now only resets the category and subcategory dropdowns, preserving the search term. Wrapped the filter dropdowns in a div with a changing key on Clear so the Select components fully remount and display "All Categories" correctly.

**Why this approach:**  
Radix Select does not reliably show placeholders when the value is `undefined` or empty string—it can get stuck on the previous selection. Using a sentinel value (`__all__`) gives Radix a valid, non-empty value that always maps to an option. Keeping search separate from Clear Filters matches user intent: "Clear Filters" should clear the dropdowns, not erase what the user typed. The key-based remount forces Radix to reset its internal state when clearing, which avoids lingering UI bugs.

### Bug 4 — Wrong app name in browser tab

**File:** `app/layout.tsx`

**Problem:**  
The page metadata still had the default Next.js scaffold values. The browser tab showed "Create Next App" instead of the actual app name, and the description was "Generated by create next app".

**Fix:**  
Updated the metadata to use "StackShop" as the title and a proper description for the sample eCommerce catalog.

**Why this approach:**  
The app header already showed "StackShop"—the metadata should match. Updating layout metadata is the standard Next.js way to control the browser tab title and description, with no extra dependencies.

### Bug 5 — No pagination for product list; crash when accessing invalid page (e.g. page 7)

**File:** `app/page.tsx`

**Problem:**  
The product list was limited to 20 items with no way to see more. The catalog has 100 products but users could only view the first 20. Navigating to an invalid page (e.g. page 7 via URL) caused application crashes.

**Fix:**  
Added pagination with `safePage` clamping. Invalid page URLs are corrected to the last valid page without crashing.

**Why this approach:**  
The API already supported `limit` and `offset`—pagination was a frontend change. A clamped `safePage` value ensures we never fetch or render with an out-of-bounds page, so invalid URLs (e.g. `?page=7` with only 5 pages) are corrected instead of causing errors. Keeping the fetch offset based on the clamped value avoids empty-result states and crashes.

### Bug 6 — Filters reset when returning from product detail

**File:** `app/page.tsx`, `app/product/page.tsx`

**Problem:**  
When you selected a category and subcategory, viewed the filtered products, clicked on one to see details, and then clicked Back—the filters were reset and you lost your filtered results. The Back button erased your filters.

**Fix:**  
Filters are now stored in the URL (e.g. `/?category=Headphones&subCategory=Earbud%20Headphones`). When filters change, the URL updates. The product page Back button uses `router.back()` instead of linking to `/`, so it returns to the previous URL with the filters preserved. When the home page loads with URL params, it restores the filter state from the URL.

**Why this approach:**  
URL-based state survives navigation: when the user returns via Back, the browser loads the previous URL (with filters) and the app restores state from it. `router.back()` returns to that exact URL instead of always going to `/`. This also makes filtered views shareable (e.g. via copy-paste or bookmark) and aligns with standard web behavior.

### Bug 7 — View Details buttons misaligned across product cards

**File:** `app/page.tsx`

**Problem:**  
The "View Details" buttons in the product grid were at different vertical levels because cards had varying content heights (titles and category tags wrapping to different numbers of lines). Cards with longer category names or more badge text pushed the button lower, making the grid look uneven.

**Fix:**  
Used flexbox to pin the button to the bottom of each card. Added `flex-1 min-h-0` to the card content so it fills the space, `shrink-0` on the header and footer, and `mt-auto` on the footer so the button stays aligned across all cards regardless of content length. Also added `line-clamp-2` to the category badges to limit wrapping.

**Why this approach:**  
Flexbox with `flex-1` on the content area makes it grow to fill remaining space, pushing the footer (and button) to the bottom. `min-h-0` avoids flex overflow issues. `line-clamp-2` on badges limits variability so all cards have a more consistent height. This keeps layout consistent without changing the overall card structure.

### Bug 8 — Application crash when clicking product (URL length overflow)

**File:** `app/page.tsx`, `app/product/page.tsx`

**Problem:**  
Clicking on a product to view details could cause an application crash with "Application error: a client-side exception has occurred". The full product object (including long titles, multiple image URLs, and feature bullet text) was passed as JSON in the URL query string. Product data often exceeded browser URL length limits (~2KB–8KB), causing navigation to fail and the app to crash.

**Fix:**  
Changed product links to use the SKU instead of the full product JSON: `/product?sku=XXX`. The product detail page now fetches the product by SKU from the existing `/api/products/[sku]` endpoint. This keeps URLs short, avoids parse errors, and prevents crashes from oversized URLs. The product page still supports the legacy `?product=` param for backwards compatibility.

**Why this approach:**  
Passing the full product in the URL violated browser URL length limits and caused crashes. The `/api/products/[sku]` API already existed, so using the SKU was a small change. SKU-based URLs are shorter, safer, and match REST-style resource access. Keeping support for `?product=` avoids breaking any existing links or bookmarks.

### Bug 9 — Page 8 (and other valid pages) showing nothing; pagination race conditions

**File:** `app/page.tsx`

**Problem:**  
Navigating to page 8 (or loading `?page=8` directly) often showed nothing. A page-correction effect reset the page to 1 whenever `totalProducts` was 0 (e.g. during initial load before the fetch completed). That reset triggered a refetch for page 1, causing a race where an old response could overwrite the correct data. The URL was also overwritten with `page=1` before the total was known, and rapid page changes could leave multiple fetches in flight with no way to cancel the stale one.

**Fix:**  
Only run the page-correction clamp when `totalProducts > 0`, so we do not reset the page before the first fetch completes. Introduce `pageForUrl` so the URL keeps the requested page until the total is known (e.g. `?page=8` stays until we know there are 25 pages). Add an `AbortController` to cancel the previous fetch when filters or page change, preventing stale responses from overwriting newer ones.

**Why this approach:**  
Clamping when `totalProducts === 0` was wrong because we did not yet know the max page. Preserving the requested page in the URL avoids the sync effect from overwriting it. `AbortController` is the standard way to cancel in-flight fetches when dependencies change.

### Bug 10 — Client-side crash: "Cannot read properties of undefined (reading '0')"

**File:** `app/page.tsx`

**Problem:**  
Loading the product list (especially page 8) could crash with "Application error: a client-side exception has occurred". The error came from accessing `product.imageUrls[0]` when `imageUrls` could be undefined, or from treating `products` or API response fields as always defined.

**Fix:**  
Add defensive checks: use optional chaining for `product.imageUrls?.[0]`, fallbacks for `product.categoryName` and `product.subCategoryName`, and ensure `data.products` and `data.total` from the API are validated before use (`Array.isArray`, `typeof`). Use `(products ?? []).map` and `!products || products.length === 0` so missing or non-array values do not cause crashes. Validate `page` with `Number.isFinite` before using it in `safePage`.

**Why this approach:**  
The API and data may vary; defensive checks avoid crashes from malformed or partial responses. Optional chaining and nullish coalescing are minimal, clear changes that make the UI robust without changing behavior for valid data.

### Bug 11 — Product price (retailPrice) not displayed

**Files:** `lib/products.ts`, `app/page.tsx`, `app/product/page.tsx`

**Problem:**  
The product data includes `retailPrice` for every item in `sample-products.json`, but the application never displayed it. The `Product` interface did not include `retailPrice`, and the product list and detail pages showed no pricing. For an eCommerce app, price is essential information that users expect to see.

**Fix:**  
Added `retailPrice?: number` to the `Product` interface in `lib/products.ts` and to the local `Product` interfaces in the list and detail pages. Display the price on product cards (below the title, formatted as currency) and prominently on the product detail page (below the title, larger font). Use `typeof product.retailPrice === "number"` before rendering so products without a price (if any) do not show invalid output.

**Why this approach:**  
The data was already present; the fix is to expose it in the UI. Making `retailPrice` optional in the interface keeps compatibility if any products lack the field. Formatting with `toFixed(2)` and a dollar sign matches common eCommerce display. The defensive check ensures we only render when the value is a valid number.

### Bug 12 — Products API accepted invalid limit/offset parameters

**File:** `app/api/products/route.ts`

**Problem:**  
The products API read `limit` and `offset` from query params using `parseInt` without validation. Non-numeric values (e.g. `limit=abc`) produced `NaN`, and negative values were passed through. JavaScript's `slice()` coerces these in unpredictable ways—e.g. `slice(NaN, NaN)` returns an empty array, and negative indices mean "from end"—so the API could return empty or incorrect result sets without any error. Callers had no indication that their parameters were invalid.

**Fix:**  
Added validation helpers `parsePositiveInt` and `parseNonNegativeInt` that ensure `limit` is a positive integer (bounded by a `MAX_LIMIT` of 100) and `offset` is a non-negative integer. Invalid or missing values fall back to safe defaults (20 and 0). This guarantees the API always receives valid numbers and returns predictable results.

**Why this approach:**  
Validating at the API boundary prevents bad input from propagating. Using explicit helpers keeps the route handler readable and makes the validation rules reusable. Bounding `limit` avoids excessive response sizes. Defaults for invalid input keep the API robust while preserving expected behavior for normal requests.

## Enhancements

- **Product card hover feedback** — Stronger hover state (ring, shadow, lift) so it's clear which product is focused



























