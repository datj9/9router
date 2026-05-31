// Shared validation for API key manager metadata, used by the create and
// update routes so the rules stay in one place.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate optional API key metadata. Returns an error string, or null when valid.
 * Both fields are optional; only their format/sanity is checked when present.
 */
export function validateKeyMetadata({ managerEmail, expiresAt }) {
  if (managerEmail !== undefined && managerEmail !== null && String(managerEmail).trim()) {
    if (!EMAIL_PATTERN.test(String(managerEmail).trim())) {
      return "Manager email is not a valid email address";
    }
  }

  if (expiresAt !== undefined && expiresAt !== null && String(expiresAt).trim()) {
    const expiry = new Date(expiresAt).getTime();
    if (Number.isNaN(expiry)) {
      return "Expiration date is invalid";
    }
  }

  return null;
}
