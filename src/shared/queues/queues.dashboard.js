const { Queue } = require('bullmq');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const { redisConnection } = require('../config/redis');
const { createEmailTransactionalQueue } = require('./email-transactional.queue');
const { QUEUE_NAMES } = require('./queue.constants');

const DASHBOARD_PATH = '/admin/queues';

function createQueuesDashboard() {
  const emailQueue = createEmailTransactionalQueue();

  const emailDlq = new Queue(
    QUEUE_NAMES.EMAIL_TRANSACTIONAL_DLQ,
    {
      connection: redisConnection,
    }
  );

  const serverAdapter = new ExpressAdapter();

  serverAdapter.setBasePath(DASHBOARD_PATH);

  createBullBoard({
    queues: [
      new BullMQAdapter(emailQueue),
      new BullMQAdapter(emailDlq),
    ],
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: 'Forca Fitness - Colas',
      },
    },
  });

  return {
    path: DASHBOARD_PATH,
    router: serverAdapter.getRouter(),
  };
}

module.exports = {
  createQueuesDashboard,
};
