## MODIFIED Requirements

### Requirement: Joining move sequences
The system SHALL join move sequences into one, merging consecutive turns of the same layers where they meet by summing
quarter turns mod 4 (a cancelled pair disappears). Moves turn the same layers only when they are the same move apart
from the amount (`U`, `U2`, `U'`; `Rw`, `Rw'`), so a face turn and a wide turn of that face (`R`, `Rw`) are never merged.
It is used to prepend AUFs to setups and scrambles.

#### Scenario: Cancelling
- **WHEN** `R U` is joined with `U' F`
- **THEN** the result is `R F`

#### Scenario: Merging
- **WHEN** `U` is joined with `U R`
- **THEN** the result is `U2 R`

#### Scenario: Face and wide turn
- **WHEN** `R` is joined with `Rw'`
- **THEN** the result is `R Rw'`
