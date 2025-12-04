export function getUnseenMessageCountWhere(
  conversationId: number,
  userId: number,
  isUser1: boolean,
) {
  return {
    conversationId,
    isSeen: false,
    senderId: {
      not: userId,
    },
    isDeletedU1: isUser1 ? false : undefined,
    isDeletedU2: isUser1 ? undefined : false,
  };
}
