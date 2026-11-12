const { Worker, Queue } = require('bullmq');
const { redisConnection } = require('../config/redis');
const { sendTransactionalEmail } = require('../messaging/email.client');
const { QUEUE_NAMES, JOB_NAMES } = require('./queue.constants');

function buildEmailPayload(job) {
  if (job.name !== JOB_NAMES.SEND_TRANSACTIONAL_EMAIL) {
    throw new Error(`Tipo de tarea no soportado: ${job.name}`);
  }

  const {
    recipient,
    subject,
    template,
    context = {},
  } = job.data;

  return {
    recipient,
    subject,
    text:
      context.text ||
      `Correo transaccional generado con la plantilla: ${template}`,
    html: context.html,
    attachments: context.attachments || [],
  };
}

function createEmailTransactionalWorker(connection = redisConnection) {
  const dlq = new Queue(QUEUE_NAMES.EMAIL_TRANSACTIONAL_DLQ, {
    connection,
  });

  const worker = new Worker(
    QUEUE_NAMES.EMAIL_TRANSACTIONAL,
    async (job) => {
      const emailPayload = buildEmailPayload(job);

      const result = await sendTransactionalEmail(emailPayload);

      return {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        response: result.response,
        traceId: job.data.traceId,
      };
    },
    {
      connection,
    }
  );

  worker.on('completed', (job, result) => {
    console.log(
      `[EMAIL][COMPLETED] job=${job.id} traceId=${job.data.traceId} messageId=${result.messageId}`
    );
  });

  worker.on('failed', async (job, error) => {
    const attempts = job?.opts?.attempts || 1;
    const attemptsMade = job?.attemptsMade || 0;

    if (attemptsMade >= attempts) {
      console.error(
        `[EMAIL][FAILED_FINAL] job=${job?.id} traceId=${job?.data?.traceId} error=${error.message}`
      );

      try {
        await dlq.add(JOB_NAMES.FAILED_TRANSACTIONAL_EMAIL, {
          originalJobId: job?.id,
          originalJobName: job?.name,
          data: job?.data,
          error: error.message,
          attemptsMade,
          failedAt: new Date().toISOString(),
        });

        console.log(
          `[EMAIL][DLQ] job=${job?.id} enviado a ${QUEUE_NAMES.EMAIL_TRANSACTIONAL_DLQ}`
        );
      } catch (dlqError) {
        console.error(
          `[EMAIL][DLQ_ERROR] job=${job?.id} error=${dlqError.message}`
        );
      }

      return;
    }

    console.warn(
      `[EMAIL][RETRY] job=${job?.id} traceId=${job?.data?.traceId} intento=${attemptsMade}/${attempts} error=${error.message}`
    );
  });

  worker.on('error', (error) => {
    console.error(`[EMAIL][WORKER_ERROR] ${error.message}`);
  });

  worker.on('closed', async () => {
    await dlq.close();
  });

  return worker;
}

module.exports = {
  createEmailTransactionalWorker,
};
