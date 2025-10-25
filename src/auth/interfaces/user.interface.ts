import { User } from 'generated/prisma';

export type AuthenticatedUser = Omit<User, 'password' | 'deleted_at'>;
