-- Existing accounts registered before email verification was required.
-- Mark them verified so requireEmailVerification does not lock them out.
UPDATE "user" SET email_verified = true WHERE email_verified = false;
