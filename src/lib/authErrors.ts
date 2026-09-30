export interface SupabaseAuthErrorLike {
  status?: number;
  code?: string;
  message?: string;
  name?: string;
}

export function authErrorMessage(error: unknown, action: 'signup' | 'login'): string {
  const authError = (error && typeof error === 'object' ? error : {}) as SupabaseAuthErrorLike;
  const status = authError.status;
  const code = authError.code?.toLowerCase() ?? '';
  const message = authError.message?.toLowerCase() ?? '';

  if (status === 429 || code.includes('rate') || message.includes('rate limit') || message.includes('too many requests')) {
    return 'Too many signup attempts. Please wait a few minutes and try again.';
  }
  if (code.includes('email_not_confirmed') || message.includes('email not confirmed') || message.includes('email confirmation')) {
    return 'Check your email to confirm your account before signing in.';
  }
  if (action === 'login' && (code.includes('invalid_credentials') || message.includes('invalid login credentials') || message.includes('invalid credentials'))) {
    return 'Incorrect email or password.';
  }
  if (code.includes('weak_password') || message.includes('password should be') || message.includes('password is too weak')) {
    return 'Password must meet the minimum password requirements.';
  }
  if ((code.includes('email') && (code.includes('invalid') || code.includes('format'))) || message.includes('invalid email') || message.includes('email address is invalid') || (message.includes('email address') && (message.includes('invalid') || message.includes('format')))) {
    return 'Please enter a valid email address.';
  }
  if (authError.name === 'AuthRetryableFetchError' || message.includes('failed to fetch') || message.includes('network') || message.includes('fetch error') || message.includes('timeout')) {
    return 'Unable to connect to the authentication service. Check your internet connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}
