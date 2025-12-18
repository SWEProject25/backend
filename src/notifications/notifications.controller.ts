import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Services } from 'src/utils/constants';

@ApiTags('Notifications')
@ApiBearerAuth()
@ApiCookieAuth('access_token')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    @Inject(Services.NOTIFICATION)
    private readonly notificationService: NotificationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated notifications',
  })
  async getNotifications(@CurrentUser('id') userId: number, @Query() query: GetNotificationsDto) {
    return this.notificationService.getNotifications(
      userId,
      query.page,
      query.limit,
      query.unreadOnly,
      query.include,
      query.exclude,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  @ApiQuery({
    name: 'include',
    required: false,
    description: 'Comma-separated notification types to include (e.g., "DM,MENTION")',
    example: 'DM,MENTION',
  })
  @ApiQuery({
    name: 'exclude',
    required: false,
    description: 'Comma-separated notification types to exclude (e.g., "DM,MENTION")',
    example: 'DM,MENTION',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the count of unread notifications',
    schema: {
      example: {
        unreadCount: 5,
      },
    },
  })
  async getUnreadCount(
    @CurrentUser('id') userId: number,
    @Query('include') include?: string,
    @Query('exclude') exclude?: string,
  ) {
    const count = await this.notificationService.getUnreadCount(userId, include, exclude);
    return { unreadCount: count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
  })
  async markAsRead(@CurrentUser('id') userId: number, @Param('id') notificationId: string) {
    await this.notificationService.markAsRead(notificationId, userId);
    return { message: 'Notification marked as read' };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
  })
  async markAllAsRead(@CurrentUser('id') userId: number) {
    await this.notificationService.markAllAsRead(userId);
    return { message: 'All notifications marked as read' };
  }

  @Post('device')
  @ApiOperation({ summary: 'Register a device token for push notifications' })
  @ApiResponse({
    status: 201,
    description: 'Device token registered successfully',
  })
  async registerDevice(@CurrentUser('id') userId: number, @Body() dto: RegisterDeviceDto) {
    await this.notificationService.registerDevice(userId, dto.token, dto.platform);
    return { message: 'Device registered successfully' };
  }

  @Delete('device/:token')
  @ApiOperation({ summary: 'Remove a device token' })
  @ApiResponse({
    status: 200,
    description: 'Device token removed successfully',
  })
  async removeDevice(@Param('token') token: string) {
    await this.notificationService.removeDevice(token);
    return { message: 'Device removed successfully' };
  }
}
