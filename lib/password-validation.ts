export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Check length (8-12 characters)
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (password.length > 12) {
    errors.push("Password must be no more than 12 characters long");
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  // Check for at least one number
  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function getPasswordStrengthColor(password: string): string {
  const { isValid, errors } = validatePassword(password);
  
  if (password.length === 0) return "border-input";
  if (isValid) return "border-green-500";
  if (errors.length <= 2) return "border-yellow-500";
  return "border-red-500";
}

export function getPasswordRequirements(): string[] {
  return [
    "8-12 characters long",
    "At least one uppercase letter (A-Z)",
    "At least one lowercase letter (a-z)", 
    "At least one number (0-9)",
    "Symbols are optional but allowed"
  ];
}
