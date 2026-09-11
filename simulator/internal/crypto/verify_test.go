package crypto

import (
	"testing"
)

func TestVerifySignature_NilPublicKey(t *testing.T) {
	// Zero Trust verification: nil public key must be rejected
	res := VerifySignature(nil, []byte("firmware_data"), "some_sig")
	if res.Valid {
		t.Fatalf("expected Valid to be false when public key is nil, got true")
	}
	if res.DetectionStage != "missing_public_key" {
		t.Fatalf("expected DetectionStage to be 'missing_public_key', got '%s'", res.DetectionStage)
	}

	resHex := VerifySignatureFromHex(nil, "abcdef", "some_sig")
	if resHex.Valid {
		t.Fatalf("expected Valid to be false in VerifySignatureFromHex when public key is nil, got true")
	}
	if resHex.DetectionStage != "missing_public_key" {
		t.Fatalf("expected DetectionStage to be 'missing_public_key', got '%s'", resHex.DetectionStage)
	}
}