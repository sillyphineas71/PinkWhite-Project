import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { PaginationQueryDto } from './dto/inbox.dto';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import {
  CurrentUser,
  AuthUser,
} from '../auth/decorators/current-user.decorator';

@ApiTags('Chat')
@ApiCookieAuth()
@Controller('chat')
@UseGuards(JwtAccessGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('inbox')
  @ApiOperation({ summary: 'UC-CHAT-004: Get user inbox' })
  async getInbox(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.chatService.getInbox(user.userId, query);
  }

  @Post(':matchId/read')
  @ApiOperation({ summary: 'UC-CHAT-003: Mark conversation as read' })
  async markConversationAsRead(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
  ) {
    return this.chatService.markConversationAsRead(user.userId, matchId);
  }

  @Post(':matchId/messages')
  @ApiOperation({ summary: 'UC-CHAT-002: Send message to a match' })
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.userId, matchId, dto);
  }

  @Get(':matchId/messages')
  @ApiOperation({ summary: 'UC-CHAT-001: Get messages in a match' })
  async getConversationMessages(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.chatService.getConversationMessages(
      user.userId,
      matchId,
      query,
    );
  }
}
