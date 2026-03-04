# src/main/security/ — Security Subsystem

- **`CertificateStore`**: Persists trusted/untrusted certificate decisions per server origin. Consulted when Electron encounters certificate errors.
- **`PermissionsManager`**: Web permissions (media, geolocation, notifications, fullscreen) per origin with dialog-based authorization. Performs OS-level media access checks on macOS.
- **`PreAuthManager`**: Intercepts authentication challenges before requests reach web contents — handles pre-auth headers, client certificate selection, and basic auth modals.
- **`AllowProtocolDialog`**: Manages allowed custom protocols for external links (e.g., `tel:`, `mailto:`). Persists the allowlist across sessions.

Related: `SecureStorage` (`src/main/secureStorage.ts`) for encrypted per-server secrets, `NonceManager` (`src/main/nonceManager.ts`) for CSP nonces.

## Adding a new permission type

1. Add the permission name to the `PermissionsManager` handler map.
2. Implement the check logic — may need OS-level access checks on macOS (e.g., `systemPreferences.getMediaAccessStatus()`).
3. Create a user-facing authorization dialog if the permission requires explicit consent.
4. Persist the decision per origin so it's remembered across sessions.
