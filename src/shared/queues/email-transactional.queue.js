const { Queue } = require('bullmq');
const { QUEUE_NAMES, JOB_NAMES } = require('./queue.constants');

function createEmailTransactionalQueue(redisConnection) {
  if (!redisConnection) {
    throw new Error('Se requiere una conexion Redis para crear la cola.');
  }

  return new Queue(QUEUE_NAMES.EMAIL_TRANSACTIONAL, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: {
        count: 1000,
      },
      removeOnFail: {
        count: 5000,
      },
    },
  });
}

async function enqueueTransactionalEmail(queue, data) {
  const {
    recipient,
    subject,
    template,
    context,
    traceId,
  } = data;

  return queue.add(JOB_NAMES.SEND_TRANSACTIONAL_EMAIL, {
    recipient,
    subject,
    template,
    context,
    traceId,
  });
}

module.exports = {
  createEmailTransactionalQueue,
  enqueueTransactionalEmail,
};
