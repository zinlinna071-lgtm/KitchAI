# Shared Ingredient Pools and Recipe Membership

**Owner requirement captured:** 2026-10-14  
**Scope:** Design input for recipe, production, inventory, and costing work; not a claim that WP3.2 already implements this workflow.

## Problem

Some ingredients are bought and used as a whole container or shared cooking medium. Example: one bottle of frying oil is used to fry chicken and pork products over several days. It is not practical or truthful to require the operator to record a precise millilitre quantity on each recipe line. The recipe should be able to say that oil is used without inventing a per-product quantity.

## Recipe ingredient modes

A future recipe line should support at least:

1. **Measured quantity** — a quantity and unit are known and can be recorded.
2. **Ingredient included / shared pool** — the product uses the ingredient, but the operator does not specify an exact per-recipe quantity.
3. **To taste / estimated** — the operator can keep an instruction such as “a little” or “to taste”; any estimate must be explicitly labelled and must not be presented as a measured fact.

These modes must not be confused. A shared-pool line records membership/use, not a hidden zero quantity and not a made-up quantity.

## Purchase-to-depletion pool

For a shared ingredient, support a traceable pool/cycle such as:

- 1 Oct: purchase one bottle of oil, record container quantity 1 bottle, purchase cost, and opening time/date.
- 1–5 Oct: record production batches and their product outputs for every menu that uses oil, plus any directly recorded waste, spills, or other losses.
- 5 Oct: operator confirms that the bottle/pool is depleted; record depletion time/date and any remaining quantity if known.

A purchase does not mean the entire bottle cost should immediately be charged to the first product that uses it. The system should associate eligible production with the pool cycle and disclose that allocation is estimated when exact consumption by menu is unknown.

## Cost allocation and profit

Sales alone cannot establish how much oil each product consumed. Production records identify the products that could carry the pool cost; sales records identify which finished units were sold; finished-stock and disposition records identify what remains, is wasted, given away, or consumed personally.

The costing design must therefore make its allocation basis explicit and auditable. Candidate policies to compare in the costing work package:

- **Equal per produced unit among eligible products** — transparent, but an approximation if products use different amounts of oil.
- **Operator-defined product weights/shares** — e.g. allocate a configured percentage of the pool to chicken and another to pork.
- **Batch-level measured/estimated allocation** — record an optional batch share when the operator has a reasonable estimate.

Do not silently choose a precise per-menu consumption figure. Until an allocation basis is selected, report the shared pool cost as unallocated/estimated rather than presenting exact product margins.

Once allocated, product cost must follow inventory disposition:
- sold units: their allocated cost contributes to cost of goods sold;
- unsold finished units kept for later sale: retain the associated cost in finished-stock value;
- discarded/wasted units: record the relevant cost as waste;
- giveaway or personal consumption: record a non-sale disposition and its cost separately, never as revenue.

The same cost must not be charged both to the pool and again as an unrelated per-recipe measured quantity.

## Inventory integrity

- Keep purchase quantity in the unit actually purchased (e.g. 1 bottle) if the operator cannot measure the bottle's contents.
- Do not convert bottles to millilitres unless the container volume is known and the conversion is intentionally configured.
- A pool can be shared by multiple menu products, but all use, production, disposition, and depletion records must be linked so the same purchase cost is not allocated twice.
- The operator-confirmed depletion event closes the pool; it does not fabricate an exact physical usage measurement.
- If some oil remains at the end of the reporting period, do not allocate the whole bottle cost to sold products without accounting for remaining pool value or clearly labelling a chosen approximation.

## Work-package placement

- **WP3.2:** trusted atomic posting and ledger integrity; it should not infer per-recipe oil quantities.
- **WP3.3:** production batch snapshot and links to recipe ingredient membership; batch start snapshots recipe version and ingredient modes.
- **Later costing/inventory work package:** pool lifecycle, depletion, allocation basis, cost carry-through, and profit calculations.
- **Finished-stock disposition work:** keep sale, carry-over, waste, giveaway, and personal consumption distinct.

## Acceptance tests for the future costing work

- A single oil purchase can be linked to more than one menu product.
- Recipe lines can declare “uses oil” without a quantity and without silently becoming zero-cost.
- A pool can span multiple production days and closes only when depletion is recorded.
- Production counts, sales counts, unsold finished inventory, and each disposition remain separately auditable.
- The same pool cost is never double-counted.
- Reports distinguish measured, estimated, and unallocated costs and avoid implying exact consumption where none was measured.
