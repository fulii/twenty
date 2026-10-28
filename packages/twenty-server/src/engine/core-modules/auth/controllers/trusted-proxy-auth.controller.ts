import {
  Controller,
  Get,
  NotFoundException,
  Query,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Request, Response } from 'express';
import { ApiPath, AppPath } from 'twenty-shared/types';
import { Repository } from 'typeorm';

import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';
import { AuthService } from 'src/engine/core-modules/auth/services/auth.service';
import { LoginTokenService } from 'src/engine/core-modules/auth/token/services/login-token.service';
import { getTrustedProxyEmail } from 'src/engine/core-modules/auth/utils/get-trusted-proxy-email.util';
import { WorkspaceDomainsService } from 'src/engine/core-modules/domain/workspace-domains/services/workspace-domains.service';
import { GuardRedirectService } from 'src/engine/core-modules/guard-redirect/services/guard-redirect.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';

// Sign-in behind a gateway that has already authenticated the person and
// granted them this app (AUTH_TRUSTED_PROXY_SECRET): its grant stands in for
// an invitation, and the first person in creates the workspace
@Controller(ApiPath.Auth)
@UseFilters(AuthRestApiExceptionFilter)
export class TrustedProxyAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginTokenService: LoginTokenService,
    private readonly userService: UserService,
    private readonly guardRedirectService: GuardRedirectService,
    private readonly workspaceDomainsService: WorkspaceDomainsService,
    private readonly twentyConfigService: TwentyConfigService,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
  ) {}

  @Get('trusted-proxy')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async trustedProxyAuth(
    @Req() req: Request,
    @Res() res: Response,
    @Query('returnToPath') returnToPath?: string,
  ) {
    const email = getTrustedProxyEmail(
      req,
      this.twentyConfigService.get('AUTH_TRUSTED_PROXY_SECRET'),
    );

    if (email === null) {
      throw new NotFoundException();
    }

    // ponytail: single-workspace deployments only, the oldest workspace is the one
    const currentWorkspace =
      (await this.workspaceRepository.findOne({
        where: {},
        order: { createdAt: 'ASC' },
        relations: ['approvedAccessDomains'],
      })) ?? undefined;

    try {
      const { userData } = this.authService.formatUserDataPayload(
        { email, isEmailAlreadyVerified: true },
        await this.userService.findUserByEmail(email),
      );

      const { workspace, user } = await this.authService.signInUp({
        userData,
        workspace: currentWorkspace,
        authParams: { provider: AuthProviderEnum.SSO },
      });

      const loginToken = await this.loginTokenService.generateLoginToken(
        user.email,
        workspace.id,
        AuthProviderEnum.SSO,
      );

      return res.redirect(
        this.authService.computeRedirectURI({
          loginToken: loginToken.token,
          workspace,
          returnToPath,
        }),
      );
    } catch (error) {
      return res.redirect(
        this.guardRedirectService.getRedirectErrorUrlAndCaptureExceptions({
          error,
          workspace:
            this.workspaceDomainsService.getSubdomainAndCustomDomainFromWorkspaceFallbackOnDefaultSubdomain(
              currentWorkspace,
            ),
          pathname: AppPath.Verify,
        }),
      );
    }
  }
}
