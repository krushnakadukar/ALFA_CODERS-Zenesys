import type { NotificationEnvelope } from "./domain.js";

export interface NotificationChannel {
  channel: NotificationEnvelope["channel"];
  send(notification: NotificationEnvelope): Promise<{ delivered: boolean; error?: string }>;
}

export interface NotificationRepository {
  enqueue(notification: NotificationEnvelope): Promise<string>;
  markDelivered(notificationId: string): Promise<void>;
  markFailed(notificationId: string, error: string): Promise<void>;
}

export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly channels: NotificationChannel[]
  ) {}

  async publish(notification: NotificationEnvelope) {
    const notificationId = await this.repository.enqueue(notification);
    const channel = this.channels.find((item) => item.channel === notification.channel);
    if (!channel) {
      await this.repository.markFailed(notificationId, `No channel registered for ${notification.channel}`);
      return notificationId;
    }
    const result = await channel.send(notification);
    if (result.delivered) await this.repository.markDelivered(notificationId);
    else await this.repository.markFailed(notificationId, result.error ?? "Unknown delivery error");
    return notificationId;
  }
}
