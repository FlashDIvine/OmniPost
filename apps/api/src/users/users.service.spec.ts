import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;

  const mockDate = new Date();
  const mockUser = {
    id: 'user-uuid-1',
    username: 'alice',
    passwordHash: 'somehash',
    hashedRefreshToken: null,
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find user by username', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    const result = await service.findByUsername('alice');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { username: 'alice' },
    });
    expect(result).toEqual(mockUser);
  });

  it('should find user by id', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    const result = await service.findById('user-uuid-1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-uuid-1' },
    });
    expect(result).toEqual(mockUser);
  });

  it('should create a user', async () => {
    (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
    const result = await service.create({
      username: 'alice',
      passwordHash: 'somehash',
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        username: 'alice',
        passwordHash: 'somehash',
      },
    });
    expect(result).toEqual(mockUser);
  });

  it('should update hashed refresh token', async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({
      ...mockUser,
      hashedRefreshToken: 'newhash',
    });
    const result = await service.updateHashedRefreshToken(
      'user-uuid-1',
      'newhash',
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-uuid-1' },
      data: { hashedRefreshToken: 'newhash' },
    });
    expect(result.hashedRefreshToken).toBe('newhash');
  });
});
