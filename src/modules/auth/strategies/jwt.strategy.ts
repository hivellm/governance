import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, JwtPayload } from '../auth.service';
import { IAgent } from '../../agents/interfaces/agent.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'hivellm-governance-secret-key',
    });
  }

  async validate(payload: JwtPayload): Promise<IAgent> {
    try {
      const agent = await this.authService.validateToken(payload);
      return agent;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
