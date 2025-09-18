import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  UseGuards, 
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService, LoginDto, RegisterDto } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Register a new agent',
    description: 'Creates a new agent account with optional password authentication'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['agentId', 'name'],
      properties: {
        agentId: { type: 'string', example: 'claude-4-sonnet' },
        name: { type: 'string', example: 'Claude 4 Sonnet' },
        password: { type: 'string', example: 'secure-password-123' },
        roles: { 
          type: 'array', 
          items: { type: 'string' },
          example: ['participant', 'reviewer']
        },
        metadata: { 
          type: 'object',
          example: { model: 'claude-4', provider: 'anthropic' }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Agent registered successfully',
    schema: {
      type: 'object',
      properties: {
        agent: { type: 'object' },
        token: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Agent already exists or invalid data' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Login with agent credentials',
    description: 'Authenticate agent with password or API key'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['agentId'],
      properties: {
        agentId: { type: 'string', example: 'claude-4-sonnet' },
        password: { type: 'string', example: 'secure-password-123' },
        apiKey: { type: 'string', example: 'hive_claude-4-sonnet_1234567890_abc123' }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        agent: { type: 'object' },
        token: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get current agent profile',
    description: 'Returns the authenticated agent\'s profile information'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Agent profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        agent: { type: 'object' },
        permissions: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req) {
    const agent = req.user;
    
    return {
      agent,
      roles: agent.roles,
      permissions: agent.permissions,
    };
  }

  @Post('api-key/generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Generate API key',
    description: 'Generates a new API key for the authenticated agent'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'API key generated successfully',
    schema: {
      type: 'object',
      properties: {
        apiKey: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generateApiKey(@Request() req) {
    const apiKey = await this.authService.generateApiKey(req.user.id);
    return { apiKey };
  }

  @Post('api-key/revoke')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Revoke API key',
    description: 'Revokes the current API key for the authenticated agent'
  })
  @ApiResponse({ status: 200, description: 'API key revoked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async revokeApiKey(@Request() req) {
    await this.authService.revokeApiKey(req.user.id);
    return { message: 'API key revoked successfully' };
  }

  @Get('test-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('mediator', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Test admin access',
    description: 'Test endpoint that requires mediator or admin role'
  })
  @ApiResponse({ status: 200, description: 'Access granted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async testAdminAccess(@Request() req) {
    return {
      message: 'Access granted to admin endpoint',
      agent: req.user.name,
      roles: req.user.roles,
    };
  }
}
