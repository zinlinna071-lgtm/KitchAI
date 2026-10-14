# Phase 3 WP3.2 — Owner Decisions and Recipe Quantity Notes

**Decision status:** Owner-confirmed on 2026-10-14.  
**Implementation boundary:** These choices govern WP3.2 and downstream production work; they do not authorize hosted provisioning, billing, production secrets, or deployment.

## Confirmed AAA policies

1. **Negative stock — A: reject.** A command that would make any ingredient or finished-item balance negative must fail. A multi-record command must roll back completely; do not accept the outflow with a warning.
2. **Production recipe basis — A: snapshot at batch start.** WP3.3 must capture the exact recipe version and ingredient quantities when a production batch starts. Posting later must use that captured snapshot, not silently switch to the currently active recipe. Recipe edits after batch start affect new batches only.
3. **Corrections — A: append-only ledger.** Never edit or delete a posted stock movement. Correct mistakes through a new linked reversal/correction command so the original event and audit trail remain visible.

## Recipe ingredient quantities that are hard to measure exactly

This is a recipe/production domain requirement, not part of the WP3.2 atomic posting implementation. Do not treat a vague recipe quantity as an exact inventory quantity without an explicit measurement/conversion policy.

A future recipe-line model should distinguish:

- **Exact quantity:** a decimal quantity plus unit, represented without floating-point rounding.
- **Measured kitchen unit:** e.g. teaspoon, tablespoon, or cup, with a conversion to the inventory base unit only when the ingredient-specific conversion is configured and reviewed.
- **To-taste / estimated amount:** preserve the operator-facing instruction (e.g. “a little”, “to taste”) and mark the quantity as estimated or not yet quantified. Do not invent a precise gram/millilitre value.
- **Actual batch usage:** allow the operator to record the measured or estimated actual quantity used when producing a batch, distinct from the recipe target.

Salt, MSG, fish sauce, and similar ingredients do not share one universal conversion. A spoon's weight/volume depends on the ingredient, concentration, packing, and utensil size. If there is no verified conversion or actual-use measurement, show the inventory/cost result as incomplete or estimated rather than presenting false precision.

Position/order is presentation metadata only: use a stable recipe-line ID as identity; a zero-based position may order lines but must not encode quantity, stock identity, or business meaning.

## Implementation notes

- WP3.2 enforces negative-stock rejection and append-only ledger behavior at the trusted database boundary.
- WP3.3 must implement recipe snapshot capture before batch posting.
- Recipe quantity modes, ingredient-specific unit conversions, estimate status, and actual batch usage require a separate scoped design and tests; they are not silently introduced by the WP3.2 SQL RPC.
