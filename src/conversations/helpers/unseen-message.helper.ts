export function getUnseenMessageCountWhere(conversationId: number, userId: number) {
  return {
    conversationId,
    isSeen: false,
    senderId: {
      not: userId,
    },
  };
}
