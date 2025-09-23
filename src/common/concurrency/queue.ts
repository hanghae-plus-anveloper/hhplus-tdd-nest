const userQueues = new Map<number, Promise<any>>();

export const enqueue = async <T>(
  userId: number,
  task: () => Promise<T>,
): Promise<T> => {
  const prev = userQueues.get(userId) || Promise.resolve();
  const next = prev.then(task).finally(() => {
    if (userQueues.get(userId) === next) {
      userQueues.delete(userId);
    }
  });
  userQueues.set(userId, next);
  return next;
};
