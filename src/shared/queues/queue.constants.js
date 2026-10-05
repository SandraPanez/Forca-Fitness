const QUEUE_NAMES = Object.freeze({
  EMAIL_TRANSACTIONAL: 'email-transactional-queue',
});

const JOB_NAMES = Object.freeze({
  SEND_TRANSACTIONAL_EMAIL: 'send-transactional-email',
});

module.exports = {
  QUEUE_NAMES,
  JOB_NAMES,
};
