package auth

import (
	"testing"
)

func TestPasswordHashing(t *testing.T) {
	raw := "SecurePassword@2026"
	hashed, err := HashPassword(raw)
	if err != nil {
		t.Fatalf("Failed to hash password: %v", err)
	}

	if !CheckPassword(hashed, raw) {
		t.Errorf("Password check failed for correct password")
	}

	if CheckPassword(hashed, "WrongPassword") {
		t.Errorf("Password check succeeded for wrong password")
	}
}

func TestJWTGenerationAndValidation(t *testing.T) {
	userID := "00000000-0000-0000-0000-000000000001"
	username := "testadmin"
	role := "admin"

	tokenStr, err := GenerateAccessToken(userID, username, role)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	claims, err := ValidateAccessToken(tokenStr)
	if err != nil {
		t.Fatalf("Failed to validate token: %v", err)
	}

	if claims.UserID != userID || claims.Username != username || claims.Role != role {
		t.Errorf("Claims mismatch: got %+v", claims)
	}

	// Tampered token test
	tampered := tokenStr + "tampered"
	if _, err := ValidateAccessToken(tampered); err == nil {
		t.Errorf("Tampered token should have failed validation")
	}
}

func TestRefreshToken(t *testing.T) {
	raw, hash, err := GenerateRefreshToken()
	if err != nil {
		t.Fatalf("Failed to generate refresh token: %v", err)
	}

	if len(raw) == 0 || len(hash) == 0 {
		t.Errorf("Refresh token or hash is empty")
	}

	computedHash := HashRefreshToken(raw)
	if computedHash != hash {
		t.Errorf("Computed hash %s does not match generated hash %s", computedHash, hash)
	}
}
