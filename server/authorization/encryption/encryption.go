package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/google/uuid"
)

func GenerateState(userId string) (string, error) {
	// Check if the encryption key is set
	if os.Getenv("ENCRYPTION_KEY") == "" {
		return "", fmt.Errorf("ENCRYPTION_KEY environment variable not set")
	}
	return encryptState(userId)
}

func encryptState(userId string) (string, error) {
	// generate a random string
	randomString := uuid.New().String()
	timestamp := time.Now().Unix()
	data := struct {
		UserId    string `json:"user_id"`
		Timestamp int64  `json:"timestamp"`
		Random    string `json:"random"`
	}{
		UserId:    userId,
		Timestamp: timestamp,
		Random:    randomString,
	}

	encryptedString, err := Encrypt(data, []byte(os.Getenv("ENCRYPTION_KEY")))
	if err != nil {
		return "", err
	}

	return encryptedString, nil
}

func Encrypt(data interface{}, key []byte) (string, error) {
	plaintext, err := json.Marshal(data)
	if err != nil {
		return "", err
	}

	// Ensure key is valid (16, 24, or 32 bytes for AES-128, AES-192, or AES-256)
	key, err = validateAndNormalizeKey(key)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	// Create a new GCM mode cipher
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// Create a nonce (Number used ONCE)
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	// Encrypt and authenticate the plaintext
	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)

	// Return base64 encoded string for safe transmission
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func Decrypt(encryptedData string, key []byte) ([]byte, error) {
	// Decode from base64
	ciphertext, err := base64.StdEncoding.DecodeString(encryptedData)
	if err != nil {
		return nil, err
	}

	// Ensure key is valid (16, 24, or 32 bytes for AES-128, AES-192, or AES-256)
	key, err = validateAndNormalizeKey(key)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	// Get the nonce size
	nonceSize := gcm.NonceSize()

	// Ensure the ciphertext is big enough to contain a nonce and data
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	// Extract the nonce from the ciphertext
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	// Decrypt the data
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

// validateAndNormalizeKey ensures the key has a valid length for AES (16, 24, or 32 bytes)
// If not, it creates a derived key of appropriate length
func validateAndNormalizeKey(key []byte) ([]byte, error) {
	keyLen := len(key)

	// If key is already a valid length, return it directly
	if keyLen == 16 || keyLen == 24 || keyLen == 32 {
		return key, nil
	}

	// If key is empty, return an error
	if keyLen == 0 {
		return nil, fmt.Errorf("encryption key cannot be empty")
	}

	// Use SHA-256 to derive a 32-byte key
	// This is much more secure than the previous key expansion approach
	h := sha256.New()
	h.Write(key)
	derivedKey := h.Sum(nil) // This produces a 32-byte key for AES-256

	return derivedKey, nil
}

func DecryptState(state string) (struct {
	UserId string `json:"user_id"`
}, error) {
	result := struct {
		UserId string `json:"user_id"`
	}{}

	// Get the state encryption key
	key := []byte(os.Getenv("ENCRYPTION_KEY"))
	if len(key) == 0 {
		return result, fmt.Errorf("ENCRYPTION_KEY environment variable not set")
	}

	// Decrypt the state
	decrypted, err := Decrypt(state, key)
	if err != nil {
		return result, fmt.Errorf("failed to decrypt state: %v", err)
	}

	// Parse the decrypted data
	var decodedState struct {
		UserId    string `json:"user_id"`
		Timestamp int64  `json:"timestamp"`
		Random    string `json:"random"`
	}

	if err := json.Unmarshal(decrypted, &decodedState); err != nil {
		return result, fmt.Errorf("failed to parse state: %v", err)
	}

	// Check if the state has expired (30 minutes)
	if time.Now().Unix()-decodedState.Timestamp > 1800 {
		return result, fmt.Errorf("state has expired")
	}

	result.UserId = decodedState.UserId
	return result, nil
}

// EncryptString encrypts a string directly without JSON marshaling
// This is more suitable for access tokens that don't need to be structured data
func EncryptString(plainString string, key []byte) (string, error) {
	// Ensure key is valid (16, 24, or 32 bytes for AES-128, AES-192, or AES-256)
	key, err := validateAndNormalizeKey(key)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	// Create a new GCM mode cipher
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// Create a nonce (Number used ONCE)
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	// Encrypt and authenticate the plaintext
	ciphertext := gcm.Seal(nonce, nonce, []byte(plainString), nil)

	// Return base64 encoded string for safe transmission
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptString decrypts a string that was encrypted with EncryptString
func DecryptString(encryptedData string, key []byte) (string, error) {
	// Decode from base64
	ciphertext, err := base64.StdEncoding.DecodeString(encryptedData)
	if err != nil {
		return "", err
	}

	// Ensure key is valid (16, 24, or 32 bytes for AES-128, AES-192, or AES-256)
	key, err = validateAndNormalizeKey(key)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// Get the nonce size
	nonceSize := gcm.NonceSize()

	// Ensure the ciphertext is big enough to contain a nonce and data
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	// Extract the nonce from the ciphertext
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	// Decrypt the data
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}
