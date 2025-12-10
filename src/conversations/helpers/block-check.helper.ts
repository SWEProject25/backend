/**
 * Returns the Prisma where clause to check if a block exists between two users.
 * Checks both directions: user1 blocked user2 OR user2 blocked user1.
 */
export function getBlockCheckWhere(user1Id: number, user2Id: number) {
  return {
    OR: [
      { blockerId: user1Id, blockedId: user2Id },
      { blockerId: user2Id, blockedId: user1Id },
    ],
  };
}
