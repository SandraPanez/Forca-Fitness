const QUEUE_NAMES = Object.freeze({
  EMAIL_TRANSACTIONAL: 'email-transactional-queue',
  EMAIL_TRANSACTIONAL_DLQ: 'email-transactional-dlq',
});

const JOB_NAMES = Object.freeze({
  SEND_TRANSACTIONAL_EMAIL: 'send-transactional-email',
  FAILED_TRANSACTIONAL_EMAIL: 'failed-transactional-email',
});

module.exports = {
  QUEUE_NAMES,
  JOB_NAMES,
};
