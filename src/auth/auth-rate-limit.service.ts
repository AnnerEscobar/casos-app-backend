import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type AuthAction = 'login' | 'register' | 'recover-password';

interface AttemptState {
  count: number;
  resetAt: number;
}

@Injectable()
export class AuthRateLimitService {
  private readonly attempts = new Map<string, AttemptState>();
  private readonly windowMs = 15 * 60 * 1000;

  private readonly limits: Record<AuthAction, number> = {
    login: 5,
    register: 3,
    'recover-password': 3,
  };

  assertAllowed(action: AuthAction, identifier: string): void {
    const now = Date.now();
    const key = `${action}:${identifier}`;
    const current = this.attempts.get(key);

    if (!current || current.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }

    if (current.count >= this.limits[action]) {
      throw new HttpException(
        'Demasiados intentos. Intenta nuevamente en unos minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
  }

  reset(action: AuthAction, identifier: string): void {
    this.attempts.delete(`${action}:${identifier}`);
  }
}
