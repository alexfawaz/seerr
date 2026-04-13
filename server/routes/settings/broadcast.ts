import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { UserPushSubscription } from '@server/entity/UserPushSubscription';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';
import { In } from 'typeorm';
import webpush from 'web-push';

const broadcastRoutes = Router();

let lastBroadcastTime = 0;

broadcastRoutes.post('/', async (req, res, next) => {
  const { title, body, url, userIds } = req.body as {
    title?: string;
    body?: string;
    url?: string;
    userIds?: number[];
  };

  // Validate request body
  if (!title || typeof title !== 'string' || title.length === 0) {
    return next({ status: 422, message: 'Title is required.' });
  }
  if (title.length > 50) {
    return next({
      status: 422,
      message: 'Title must be 50 characters or fewer.',
    });
  }
  if (!body || typeof body !== 'string' || body.length === 0) {
    return next({ status: 422, message: 'Message body is required.' });
  }
  if (body.length > 120) {
    return next({
      status: 422,
      message: 'Message body must be 120 characters or fewer.',
    });
  }

  // Rate limit: 60 seconds between broadcasts
  const now = Date.now();
  if (now - lastBroadcastTime < 60_000) {
    return next({
      status: 429,
      message: 'Please wait at least 60 seconds between broadcasts.',
    });
  }

  // Check VAPID keys
  const settings = getSettings();
  if (!settings.vapidPublic || !settings.vapidPrivate) {
    return next({
      status: 400,
      message:
        'Web push notifications are not configured. Set VAPID keys in Settings > Notifications.',
    });
  }

  // Get admin user for VAPID mailto
  const userRepository = getRepository(User);
  const mainUser = await userRepository.findOne({ where: { id: 1 } });

  if (!mainUser) {
    return next({ status: 500, message: 'Admin user not found.' });
  }

  // Load subscriptions
  const userPushSubRepository = getRepository(UserPushSubscription);

  let subscriptions: UserPushSubscription[];

  if (userIds && Array.isArray(userIds) && userIds.length > 0) {
    // Send to specific users
    subscriptions = await userPushSubRepository.find({
      where: { user: { id: In(userIds) } },
    });
  } else {
    // Send to all users
    subscriptions = await userPushSubRepository.find();
  }

  if (subscriptions.length === 0) {
    return res.status(200).json({ sent: 0, failed: 0 });
  }

  // Set VAPID details
  webpush.setVapidDetails(
    `mailto:${mainUser.email}`,
    settings.vapidPublic,
    settings.vapidPrivate
  );

  // Build notification payload matching the service worker's expected format
  const notificationPayload = Buffer.from(
    JSON.stringify({
      notificationType: 'BROADCAST',
      subject: title,
      message: body,
      actionUrl: url || '/',
      actionUrlTitle: 'View',
    }),
    'utf-8'
  );

  // Send in batches
  const BATCH_SIZE = 50;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              auth: sub.auth,
              p256dh: sub.p256dh,
            },
          },
          notificationPayload
        )
      )
    );

    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled') {
        sent++;
      } else {
        failed++;
        const err = (results[j] as PromiseRejectedResult).reason;
        const statusCode = err?.statusCode || err?.status;
        const isPermanentFailure = statusCode === 410 || statusCode === 404;

        logger.error(
          isPermanentFailure
            ? 'Broadcast: removing invalid push subscription'
            : 'Broadcast: transient push error',
          {
            label: 'Notifications',
            recipient: batch[j].user?.displayName,
            errorMessage: err?.message || String(err),
            statusCode: statusCode || 'unknown',
          }
        );

        if (isPermanentFailure) {
          await userPushSubRepository.remove(batch[j]);
        }
      }
    }
  }

  lastBroadcastTime = Date.now();

  logger.info(`Broadcast sent: ${sent} succeeded, ${failed} failed`, {
    label: 'Notifications',
  });

  return res.status(200).json({ sent, failed });
});

export default broadcastRoutes;
