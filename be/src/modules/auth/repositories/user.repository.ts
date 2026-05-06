import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string | null;
  isEmailVerified: boolean;
  isOnboarded: boolean;
  isBanned: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);
  private readonly users: Map<string, UserEntity> = new Map();

  async create(data: {
    email: string;
    passwordHash: string | null;
  }): Promise<UserEntity> {
    const now = new Date();
    const user: UserEntity = {
      id: randomUUID(),
      email: data.email,
      passwordHash: data.passwordHash,
      isEmailVerified: false,
      isOnboarded: false,
      isBanned: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    this.logger.debug(`[MOCK] User created: ${user.id}`);
    return { ...user };
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return { ...user };
      }
    }
    return null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async updatePasswordHash(id: string, passwordHash: string | null): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.passwordHash = passwordHash;
      user.updatedAt = new Date();
    }
  }

  async setEmailVerified(email: string): Promise<void> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        user.isEmailVerified = true;
        user.updatedAt = new Date();
        return;
      }
    }
  }

  async softDelete(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.deletedAt = new Date();
      user.updatedAt = new Date();
    }
  }

  async restore(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.deletedAt = null;
      user.updatedAt = new Date();
    }
  }
}
