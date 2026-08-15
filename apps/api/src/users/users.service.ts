import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../../generated/prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: { username: string; passwordHash: string }): Promise<User> {
    return this.prisma.user.create({
      data: {
        username: data.username,
        passwordHash: data.passwordHash,
      },
    });
  }

  async updateHashedRefreshToken(
    userId: string,
    hashedRefreshToken: string | null,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });
  }
}
