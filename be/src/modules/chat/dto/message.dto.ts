import { MessageType } from './send-message.dto';

export class MessageDto {
  id: string;
  matchId: string;
  senderId: string;
  messageType: MessageType;
  body: string | null;
  mediaUrl: string | null;
  status: string;
  createdAt: string;
}
