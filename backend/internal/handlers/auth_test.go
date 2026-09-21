package handlers

import "testing"

func TestAuthCookieSecureProductionCannotBeOverridden(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("ENV", "development")
	t.Setenv("COOKIE_INSECURE", "true")
	if !authCookieSecure() {
		t.Fatal("production cookies must be Secure even when COOKIE_INSECURE is set")
	}
}

func TestAuthCookieSecureLocalHTTP(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("ENV", "development")
	t.Setenv("COOKIE_INSECURE", "true")
	if authCookieSecure() {
		t.Fatal("explicit local HTTP mode should allow non-Secure cookies")
	}
}
