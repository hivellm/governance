import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IAgent } from '../../agents/interfaces/agent.interface';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): IAgent => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);




