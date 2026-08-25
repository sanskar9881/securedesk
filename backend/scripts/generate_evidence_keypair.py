"""
Generate an Ed25519 keypair for evidence-chain signing.

    python -m scripts.generate_evidence_keypair

Prints EVIDENCE_SIGNING_KEY and EVIDENCE_PUBLIC_KEY as env-var lines. The
private key is shown once and never stored anywhere by this script — copy
it straight into your secret manager (Render env var, not .env if this is
for production). Losing it means every future chain-head advance is
unsigned until a new key is generated and configured; it does not affect
verification of entries already signed with the old key, since the public
key that verifies them is stored separately in config, not derived from
the private key at verify time.
"""
from __future__ import annotations

from core.crypto import generate_keypair


def main() -> None:
    private_b64, public_b64 = generate_keypair()
    print("# Add to your environment (Render: Environment tab; local: backend/.env)")
    print("# The private key must never be committed or logged anywhere else.")
    print(f"EVIDENCE_ENABLED=true")
    print(f"EVIDENCE_SIGNING_KEY={private_b64}")
    print(f"EVIDENCE_PUBLIC_KEY={public_b64}")


if __name__ == "__main__":
    main()
