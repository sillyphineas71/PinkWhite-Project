import { Module } from '@nestjs/common';
import { ChatInboxRepository } from './repositories/chat-inbox.repository';
import { MessageRepository } from './repositories/message.repository';

import { DatabaseModule } from '../../database/database.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ChatController],
  providers: [ChatInboxRepository, MessageRepository, ChatService],
  exports: [ChatInboxRepository, MessageRepository, ChatService],
})
export class ChatModule {}
