# Billing Launch Status

This document records the current PropatyHub / RentNow subscription launch status.

## Certified
- Tenant monthly
- Tenant yearly
- Landlord monthly
- Agent monthly

## Provisionally accepted
- Landlord yearly
- Agent yearly

## Operator-sensitive
- Manual override can still mask intended provider truth until recovery is run.
- Identity mismatch remains a real support risk when the wrong account is loaded.
- Replay is safe only after the root cause is corrected.
- SQL remains a last-resort path, not the standard operator flow.

## Intentionally deferred
- CA / US subscription rollout
- Nigeria pricing changes
- new payment providers
- pricing redesign
- billing architecture rewrite

## Current operator expectation
- Certified lanes should be recoverable through normal billing ops without another payment.
- Provisional lanes should be treated as real revenue lanes, but verified more carefully after any incident.
- Internal `.test` accounts should be used for smoke and regression work before any paid production repeat.
