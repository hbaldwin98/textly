package encryption_test

import (
	"encoding/json"
	"os"
	"testing"
	"textly/authorization/encryption"
	"time"
)

// Simple function to verify encryption/decryption works
func TestEncryptionDecryption(t *testing.T) {
	// Define a test structure similar to our state
	testData := struct {
		UserId    string `json:"user_id"`
		Timestamp int64  `json:"timestamp"`
		Value     string `json:"value"`
	}{
		UserId:    "test-user-id",
		Timestamp: time.Now().Unix(),
		Value:     "Hello, World!",
	}

	// Get the encryption key
	key := []byte(os.Getenv("ENCRYPTION_KEY"))

	// Encrypt the test data
	encrypted, err := encryption.Encrypt(testData, key)
	if err != nil {
		t.Fatalf("Encryption test failed: %v", err)
		return
	}

	// Decrypt the data
	decrypted, err := encryption.Decrypt(encrypted, key)
	if err != nil {
		t.Fatalf("Decryption test failed: %v", err)
		return
	}

	// Parse the decrypted data
	var result struct {
		UserId    string `json:"user_id"`
		Timestamp int64  `json:"timestamp"`
		Value     string `json:"value"`
	}

	if err := json.Unmarshal(decrypted, &result); err != nil {
		t.Fatalf("Failed to parse decrypted data: %v", err)
		return
	}

	// Verify the data matches
	if result.UserId != testData.UserId || result.Value != testData.Value {
		t.Fatalf("Decrypted data does not match original: got %+v, want %+v", result, testData)
		return
	}

	t.Log("Encryption/decryption test passed successfully")
}
